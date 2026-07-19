import { prisma, forTenant } from "@itsolute/db";

// First-run onboarding state (spec §5), two independent tracks. Progress is
// derived from real tenant state — nothing to mark manually.
export async function getOnboarding(tenantId: string) {
  const db = forTenant(tenantId);
  const [plivo, sender, callCount, recoveredCount, approvedTemplate] = await Promise.all([
    db.plivoNumber.findFirst({ where: { status: "active" }, orderBy: { createdAt: "desc" } }),
    db.whatsAppSender.findFirst({ orderBy: { createdAt: "desc" } }),
    db.call.count(),
    db.recoveryMessage.count({ where: { status: { in: ["sent", "delivered", "read", "replied"] } } }),
    // template can be tenant-specific or the shared default (tenantId null)
    prisma.template.findFirst({
      where: { OR: [{ tenantId }, { tenantId: null }], category: "utility", status: "approved" },
    }),
  ]);

  const calls = {
    numberAssigned: !!plivo,
    number: plivo?.e164 ?? null,
    tested: callCount > 0,
  };
  const whatsapp = {
    connected: sender?.status === "connected",
    sender,
    templateApproved: !!approvedTemplate,
    recoverySent: recoveredCount > 0,
  };

  const callsDone = calls.numberAssigned && calls.tested;
  const whatsappDone = whatsapp.connected && whatsapp.templateApproved;

  return { calls, whatsapp, callsDone, whatsappDone, complete: callsDone && whatsappDone };
}

// "Test it" check — did a call reach the Plivo number recently, and did we fire
// a recovery message for it? (spec §5 Track 1 step 3)
export async function checkRecentTestCall(tenantId: string, withinMinutes = 30) {
  const db = forTenant(tenantId);
  const since = new Date(Date.now() - withinMinutes * 60_000);
  const call = await db.call.findFirst({
    where: { startedAt: { gte: since } },
    orderBy: { startedAt: "desc" },
    include: { recoveryMessages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!call) return { found: false as const };
  return {
    found: true as const,
    callAt: call.startedAt,
    recovery: call.recoveryMessages[0]?.status ?? null,
  };
}
