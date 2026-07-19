import { prisma, type RecoveryStatus } from "@itsolute/db";
import { sendTemplate } from "../lib/wa-platform.js";

// Correlation logic for WhatsApp status + reply events, shared by the WebSocket
// subscriber (real-time) and the reconciliation poll (gap-filling). Both are
// idempotent and forward-only, so applying the same event twice — or via both
// paths — is safe. Delivery/read status feeds billing, so we never regress a
// status and never double-count.

// Platform MessageStatus (SENT|DELIVERED|READ|FAILED) → our RecoveryStatus.
const PLATFORM_STATUS: Record<string, RecoveryStatus> = {
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
};

// Monotonic rank so we only ever advance. `failed` may arrive after sent/
// delivered but must not override an already-read/replied message.
const RANK: Record<RecoveryStatus, number> = {
  queued: 0,
  skipped: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 3,
  replied: 4,
};

const TS_FIELD: Partial<Record<RecoveryStatus, "sentAt" | "deliveredAt" | "readAt">> = {
  sent: "sentAt",
  delivered: "deliveredAt",
  read: "readAt",
};

export type StatusOutcome = "updated" | "ignored" | "unknown_message";

/**
 * Apply a delivery/read/failed status for a message we sent, keyed on
 * waMessageId. Advances the RecoveryMessage forward only. `at` stamps the
 * transition timestamp (the platform doesn't persist per-transition times, so
 * for reconciliation we stamp "now" when first observing the advance).
 */
export async function applyStatusUpdate(input: {
  waMessageId: string;
  platformStatus: string;
  at?: Date;
}): Promise<StatusOutcome> {
  const target = PLATFORM_STATUS[input.platformStatus?.toUpperCase?.()];
  if (!target) return "ignored";

  const rm = await prisma.recoveryMessage.findUnique({
    where: { waMessageId: input.waMessageId },
  });
  if (!rm) return "unknown_message";

  // Never regress. `failed` only applies from sent/delivered (rank < 3).
  if (RANK[target] <= RANK[rm.status]) return "ignored";
  if (target === "failed" && RANK[rm.status] >= RANK.read) return "ignored";

  const at = input.at ?? new Date();
  const tsField = TS_FIELD[target];
  await prisma.recoveryMessage.update({
    where: { id: rm.id },
    data: {
      status: target,
      ...(tsField && !(rm as any)[tsField] ? { [tsField]: at } : {}),
    },
  });
  return "updated";
}

// Cache brandSlug → tenantId (platform brand slugs are stable per WABA).
const tenantByBrand = new Map<string, string | null>();

export async function resolveTenantIdByBrandSlug(brandSlug: string): Promise<string | null> {
  if (tenantByBrand.has(brandSlug)) return tenantByBrand.get(brandSlug) ?? null;
  const sender = await prisma.whatsAppSender.findFirst({
    where: { platformBrandSlug: brandSlug },
    select: { tenantId: true },
  });
  const tenantId = sender?.tenantId ?? null;
  tenantByBrand.set(brandSlug, tenantId);
  return tenantId;
}

export type ReplyOutcome = "replied" | "no_match" | "unknown_brand";

/**
 * A missed caller replied on WhatsApp. Match by (tenant via brand slug, caller
 * number) to the most recent in-flight recovery message and flip it to
 * `replied`, then alert the owner. waId is bare digits; we store callerE164 with
 * a leading +.
 */
export async function applyInboundReply(input: {
  brandSlug: string;
  waId: string;
  at?: Date;
}): Promise<ReplyOutcome> {
  const tenantId = await resolveTenantIdByBrandSlug(input.brandSlug);
  if (!tenantId) return "unknown_brand";

  const callerE164 = input.waId.startsWith("+") ? input.waId : `+${input.waId}`;
  const rm = await prisma.recoveryMessage.findFirst({
    where: {
      tenantId,
      callerE164,
      status: { in: ["sent", "delivered", "read"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!rm) return "no_match";

  const at = input.at ?? new Date();
  await prisma.recoveryMessage.update({
    where: { id: rm.id },
    data: { status: "replied", repliedAt: at, readAt: rm.readAt ?? at },
  });
  // Surface the recovered call as well.
  await prisma.call.update({ where: { id: rm.callId }, data: { status: "recovered" } });
  await alertOwnerOfReply(tenantId, rm.id, callerE164);
  return "replied";
}

// ── Owner alert seam ────────────────────────────────────────────────────────
// Spec §4a.7: alert owner/staff on a reply. A real channel (WhatsApp to staff
// via the platform. Sends the tenant's configured alert template (2 params:
// {{1}} = caller, {{2}} = note) to each Staff member with alertOnMissed=true.
// Requires tenant.alertTemplateName (an approved WABA template) + a connected
// sender + at least one alert recipient; otherwise it just logs (no misleading
// or failed sends).
export async function alertOwnerOfReply(tenantId: string, recoveryMessageId: string, callerE164: string) {
  console.log(
    `[alert] tenant=${tenantId} recovery=${recoveryMessageId} caller=${callerE164} replied on WhatsApp`,
  );

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.alertTemplateName) return; // no push channel configured

  const sender = await prisma.whatsAppSender.findFirst({
    where: { tenantId, status: "connected" },
  });
  if (!sender?.platformBrandSlug) return;

  const recipients = await prisma.staff.findMany({ where: { tenantId, alertOnMissed: true } });
  if (recipients.length === 0) return;

  for (const r of recipients) {
    try {
      await sendTemplate({
        brandSlug: sender.platformBrandSlug,
        to: r.e164,
        templateName: tenant.alertTemplateName,
        variables: [callerE164, "replied to your message — follow up now"],
      });
      console.log(`[alert] pushed lead-reply alert to ${r.name} (${r.e164}) re ${callerE164}`);
    } catch (e) {
      console.error(`[alert] failed to alert ${r.e164}:`, (e as Error).message);
    }
  }
}
