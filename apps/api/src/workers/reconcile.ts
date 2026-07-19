import { prisma } from "@itsolute/db";
import { env } from "../env.js";
import { listConversations, getConversationMessages } from "../lib/wa-platform-rest.js";
import { applyStatusUpdate, applyInboundReply } from "../services/recovery-events.js";

// Reconciliation poll (spec: catch anything the WebSocket missed during a
// disconnect). Delivery/read status feeds billing, so gaps aren't acceptable —
// this re-derives current status for every in-flight recovery message from the
// platform's REST API, matched by waMessageId, forward-only via the shared
// service. No changes to the platform.

const MAX_PAGES = 10;
const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");

export interface ReconcileResult {
  brands: number;
  statusUpdates: number;
  replies: number;
}

export async function runReconciliationOnce(now: Date = new Date()): Promise<ReconcileResult> {
  const windowStart = new Date(now.getTime() - env.reconcileWindowHours * 3600_000);

  // In-flight = sent/delivered/read (still can advance or get a reply), recent.
  const inflight = await prisma.recoveryMessage.findMany({
    where: {
      status: { in: ["sent", "delivered", "read"] },
      waMessageId: { not: null },
      createdAt: { gte: windowStart },
    },
    select: { tenantId: true, callerE164: true, waMessageId: true },
  });
  if (inflight.length === 0) return { brands: 0, statusUpdates: 0, replies: 0 };

  // tenant → platform brand slug (the key the platform's REST API filters by).
  const tenantIds = [...new Set(inflight.map((r) => r.tenantId))];
  const senders = await prisma.whatsAppSender.findMany({
    where: { tenantId: { in: tenantIds }, platformBrandSlug: { not: null } },
    select: { tenantId: true, platformBrandSlug: true },
  });
  const brandByTenant = new Map(senders.map((s) => [s.tenantId, s.platformBrandSlug!]));

  // Group by brand: which caller numbers to look for, and which waMessageIds are ours.
  const byBrand = new Map<string, { callers: Set<string>; waIds: Set<string> }>();
  for (const r of inflight) {
    const brand = brandByTenant.get(r.tenantId);
    if (!brand) continue;
    const g = byBrand.get(brand) ?? { callers: new Set<string>(), waIds: new Set<string>() };
    g.callers.add(onlyDigits(r.callerE164));
    g.waIds.add(r.waMessageId!);
    byBrand.set(brand, g);
  }

  let statusUpdates = 0;
  let replies = 0;

  for (const [brand, g] of byBrand) {
    let page = 1;
    let pages = 1;
    pageLoop: while (page <= pages && page <= MAX_PAGES) {
      const { conversations, pages: totalPages } = await listConversations(brand, page);
      pages = totalPages;

      for (const c of conversations) {
        // Conversations are newest-first; once we're past the window, stop.
        if (c.lastMessageAt && new Date(c.lastMessageAt) < windowStart) break pageLoop;
        if (!g.callers.has(onlyDigits(c.contact.waId))) continue;

        const { messages } = await getConversationMessages(c.id);
        for (const m of messages) {
          if (m.direction === "OUTBOUND" && m.waMessageId && g.waIds.has(m.waMessageId)) {
            if ((await applyStatusUpdate({ waMessageId: m.waMessageId, platformStatus: m.status, at: now })) === "updated") {
              statusUpdates++;
            }
          } else if (m.direction === "INBOUND") {
            if ((await applyInboundReply({ brandSlug: brand, waId: c.contact.waId, at: new Date(m.sentAt) })) === "replied") {
              replies++;
            }
          }
        }
      }
      page++;
    }
  }

  return { brands: byBrand.size, statusUpdates, replies };
}

export function startReconciliationLoop(): { stop: () => void } {
  let running = false;
  const tick = async () => {
    if (running) return; // never overlap runs
    running = true;
    try {
      const r = await runReconciliationOnce();
      if (r.statusUpdates || r.replies) {
        console.log(`[reconcile] ${r.statusUpdates} status update(s), ${r.replies} reply(ies) across ${r.brands} brand(s)`);
      }
    } catch (err) {
      console.error("[reconcile] error:", (err as Error).message);
    } finally {
      running = false;
    }
  };
  const handle = setInterval(tick, env.reconcileIntervalMs);
  void tick(); // run once at startup
  return { stop: () => clearInterval(handle) };
}
