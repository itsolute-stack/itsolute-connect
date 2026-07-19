import { Worker, type Job } from "bullmq";
import { prisma, type RecoveryStatus, type RecoveryStatusReason } from "@itsolute/db";
import { getRedis } from "../lib/redis.js";
import { recoveryConfig } from "../config.js";
import { isWithinMessagingWindow, msUntilWindowOpen, localDateYmd } from "../lib/business-hours.js";
import { sendTemplate, WaPlatformError } from "../lib/wa-platform.js";
import { RECOVERY_QUEUE, enqueueRecovery, type RecoveryJob } from "../queues/recovery.js";

// Recovery worker (spec §4a steps 4–5). Consumes recovery jobs, applies the
// cooldown + quiet-hours guards, and sends the utility template from the
// tenant's OWN WABA via the WhatsApp platform. All recovery policy lives here.
//
// This runs as trusted system context keyed on a tenantId derived server-side
// from the Call — never client input — so it uses the base client with explicit
// tenantId filters. (Customer-facing API code uses forTenant(); step 5.)

const SENT_STATUSES: RecoveryStatus[] = ["sent", "delivered", "read", "replied"];

export interface RecoveryOutcome {
  status: RecoveryStatus | "deferred";
  reason?: RecoveryStatusReason | "call_missing" | "already_handled";
  waMessageId?: string;
  delayMs?: number;
}

interface RmFields {
  status: RecoveryStatus;
  reason?: RecoveryStatusReason | null;
  senderId?: string | null;
  templateId?: string | null;
  waMessageId?: string | null;
  sentAt?: Date | null;
}

/** One RecoveryMessage per call: update in place if it exists, else create. */
async function upsertRecoveryMessage(
  call: { id: string; tenantId: string; callerE164: string },
  f: RmFields,
) {
  const existing = await prisma.recoveryMessage.findFirst({ where: { callId: call.id } });
  const data = {
    whatsappSenderId: f.senderId ?? null,
    templateId: f.templateId ?? null,
    status: f.status,
    statusReason: f.reason ?? null,
    waMessageId: f.waMessageId ?? null,
    sentAt: f.sentAt ?? null,
  };
  if (existing) return prisma.recoveryMessage.update({ where: { id: existing.id }, data });
  return prisma.recoveryMessage.create({
    data: { tenantId: call.tenantId, callId: call.id, callerE164: call.callerE164, ...data },
  });
}

async function bumpRecoveryUsage(tenantId: string, now: Date, timeZone: string) {
  const ymd = localDateYmd(now, timeZone);
  const date = new Date(`${ymd}T00:00:00.000Z`);
  await prisma.usageDaily.upsert({
    where: { tenantId_date: { tenantId, date } },
    create: { tenantId, date, recoveryMessages: 1 },
    update: { recoveryMessages: { increment: 1 } },
  });
}

/**
 * Core recovery decision + send. Exported for direct testing (no Redis needed).
 */
export async function processRecoveryJob(
  data: RecoveryJob,
  now: Date = new Date(),
): Promise<RecoveryOutcome> {
  const call = await prisma.call.findUnique({ where: { id: data.callId } });
  if (!call) return { status: "skipped", reason: "call_missing" };

  const tenant = await prisma.tenant.findUnique({ where: { id: call.tenantId } });
  if (!tenant) return { status: "skipped", reason: "call_missing" };

  // Idempotency: if we already sent (or further) for this call, stop.
  const existing = await prisma.recoveryMessage.findFirst({ where: { callId: call.id } });
  if (existing && SENT_STATUSES.includes(existing.status)) {
    return { status: existing.status, reason: "already_handled" };
  }

  // Tenant's OWN connected WABA (sends FROM here) + an approved utility template
  // (tenant-specific first, else the shared default).
  const sender = await prisma.whatsAppSender.findFirst({
    where: { tenantId: tenant.id, status: "connected" },
  });
  // Need a connected WABA AND the platform brand slug it sends under.
  if (!sender || !sender.platformBrandSlug) {
    await upsertRecoveryMessage(call, { status: "skipped", reason: "no_sender", senderId: sender?.id });
    return { status: "skipped", reason: "no_sender" };
  }

  const template =
    (await prisma.template.findFirst({
      where: { tenantId: tenant.id, category: "utility", status: "approved" },
      orderBy: { createdAt: "desc" },
    })) ??
    (await prisma.template.findFirst({
      where: { tenantId: null, category: "utility", status: "approved" },
    }));
  if (!template) {
    await upsertRecoveryMessage(call, { status: "skipped", reason: "no_template", senderId: sender.id });
    return { status: "skipped", reason: "no_template" };
  }

  // Cooldown: skip if we already SENT to this caller within the window.
  const cooldownSince = new Date(now.getTime() - recoveryConfig.cooldownMs);
  const recent = await prisma.recoveryMessage.findFirst({
    where: {
      tenantId: tenant.id,
      callerE164: call.callerE164,
      status: { in: SENT_STATUSES },
      sentAt: { gte: cooldownSince },
    },
  });
  if (recent) {
    await upsertRecoveryMessage(call, {
      status: "skipped",
      reason: "cooldown",
      senderId: sender.id,
      templateId: template.id,
    });
    return { status: "skipped", reason: "cooldown" };
  }

  // Quiet hours: defer until the messaging window opens.
  if (!isWithinMessagingWindow(now, tenant.timezone, recoveryConfig.quietHours)) {
    const delayMs = msUntilWindowOpen(now, tenant.timezone, recoveryConfig.quietHours);
    await upsertRecoveryMessage(call, {
      status: "queued",
      reason: "quiet_hours_deferred",
      senderId: sender.id,
      templateId: template.id,
    });
    await enqueueRecovery(data, { delayMs, jobId: `call-${data.callId}-d${now.getTime()}` });
    return { status: "deferred", reason: "quiet_hours_deferred", delayMs };
  }

  // Send from the tenant's own WABA, via the platform brand it's registered under.
  const variables = [tenant.brandName, tenant.bookingUrl ?? ""];
  try {
    const { waMessageId } = await sendTemplate({
      brandSlug: sender.platformBrandSlug,
      to: call.callerE164,
      templateName: template.name,
      variables,
    });
    await upsertRecoveryMessage(call, {
      status: "sent",
      reason: null,
      senderId: sender.id,
      templateId: template.id,
      waMessageId,
      sentAt: now,
    });
    await bumpRecoveryUsage(tenant.id, now, tenant.timezone);
    return { status: "sent", waMessageId };
  } catch (err) {
    if (err instanceof WaPlatformError && err.recipientUnreachable) {
      await upsertRecoveryMessage(call, {
        status: "failed",
        reason: "not_on_whatsapp",
        senderId: sender.id,
        templateId: template.id,
      });
      return { status: "failed", reason: "not_on_whatsapp" };
    }
    // Transient/unknown error — let BullMQ retry.
    throw err;
  }
}

export function createRecoveryWorker(): Worker<RecoveryJob> {
  const connection = getRedis();
  if (!connection) throw new Error("REDIS_URL is required to start the recovery worker");
  const worker = new Worker<RecoveryJob>(
    RECOVERY_QUEUE,
    async (job: Job<RecoveryJob>) => processRecoveryJob(job.data),
    { connection, concurrency: 5 },
  );
  worker.on("failed", (job, err) =>
    console.error(`[recovery] job ${job?.id} failed:`, err.message),
  );
  worker.on("completed", (job) => console.log(`[recovery] job ${job.id} completed`));
  return worker;
}
