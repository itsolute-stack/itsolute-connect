import { prisma, forTenant } from "@itsolute/db";
import { currentMonthRange } from "./tz";

// All customer-facing reads go through forTenant(tenantId) — the tenantId comes
// from the verified session, never from the request (spec §0.5).

export async function getTenant(tenantId: string) {
  return prisma.tenant.findUnique({ where: { id: tenantId } });
}

export async function getWhatsAppSender(tenantId: string) {
  return forTenant(tenantId).whatsAppSender.findFirst({ orderBy: { createdAt: "desc" } });
}

export async function getPlivoNumber(tenantId: string) {
  return forTenant(tenantId).plivoNumber.findFirst({ where: { status: "active" }, orderBy: { createdAt: "desc" } });
}

// ── Overview (home) ─────────────────────────────────────────────────────────
// Missed = calls that reached Plivo (missed OR later recovered). Recovered =
// calls converted (a reply/booking flipped status to 'recovered'). Recovery rate
// and estimated revenue are driven by those — per the "track replies" model.
export async function getOverview(tenantId: string, timeZone: string, avgJobValue: number) {
  const db = forTenant(tenantId);
  const { start, end, label } = currentMonthRange(timeZone);
  const inMonth = { startedAt: { gte: start, lte: end } };

  const [missed, recovered, recentCalls] = await Promise.all([
    db.call.count({ where: { status: { in: ["missed", "recovered"] }, ...inMonth } }),
    db.call.count({ where: { status: "recovered", ...inMonth } }),
    db.call.findMany({
      where: { status: { in: ["missed", "recovered"] } },
      orderBy: { startedAt: "desc" },
      take: 8,
      include: { recoveryMessages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);

  const recoveryRate = missed > 0 ? recovered / missed : 0;
  const revenueRecovered = recovered * avgJobValue;

  // Daily trend for the month (missed vs recovered) — light, computed in-app.
  const calls = await db.call.findMany({
    where: { status: { in: ["missed", "recovered"] }, ...inMonth },
    select: { startedAt: true, status: true },
  });
  const days = new Map<string, { missed: number; recovered: number }>();
  for (const c of calls) {
    const key = c.startedAt.toLocaleDateString("en-CA", { timeZone });
    const d = days.get(key) ?? { missed: 0, recovered: 0 };
    d.missed += 1;
    if (c.status === "recovered") d.recovered += 1;
    days.set(key, d);
  }
  const trend = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return { periodLabel: label, missed, recovered, recoveryRate, revenueRecovered, recentCalls, trend };
}

// ── Calls ────────────────────────────────────────────────────────────────────
export interface CallFilters {
  status?: "missed" | "answered" | "recovered";
  q?: string;
  page?: number;
}
const PAGE_SIZE = 20;

export async function getCalls(tenantId: string, filters: CallFilters) {
  const db = forTenant(tenantId);
  const page = Math.max(1, filters.page ?? 1);
  const where: any = {};
  if (filters.status) where.status = filters.status;
  if (filters.q) where.callerE164 = { contains: filters.q.replace(/[^\d+]/g, "") };

  const [calls, total] = await Promise.all([
    db.call.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { recoveryMessages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    db.call.count({ where }),
  ]);
  return { calls, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getCall(tenantId: string, id: string) {
  const db = forTenant(tenantId);
  const call = await db.call.findFirst({
    where: { id },
    include: {
      recoveryMessages: { orderBy: { createdAt: "asc" } },
      bookings: true,
      plivoNumber: true,
    },
  });
  return call;
}

// ── Recovery Inbox ────────────────────────────────────────────────────────────
// Threads = recovery messages that reached the caller, newest first, with their
// call. Replies bubble to the top.
export async function getInbox(tenantId: string) {
  const db = forTenant(tenantId);
  return db.recoveryMessage.findMany({
    where: { status: { in: ["sent", "delivered", "read", "replied", "failed"] } },
    orderBy: [{ repliedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 50,
    include: { call: true },
  });
}

// ── Bookings ──────────────────────────────────────────────────────────────────
export async function getBookings(tenantId: string) {
  const db = forTenant(tenantId);
  return db.booking.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { call: true } });
}

// ── Billing usage (current cycle = this month) ──────────────────────────────────
export async function getUsageThisMonth(tenantId: string, timeZone: string) {
  const db = forTenant(tenantId);
  const { start, end } = currentMonthRange(timeZone);
  const rows = await db.usageDaily.findMany({
    where: { date: { gte: start, lte: end } },
  });
  return rows.reduce(
    (acc, r) => ({ minutes: acc.minutes + r.minutes, recoveryMessages: acc.recoveryMessages + r.recoveryMessages }),
    { minutes: 0, recoveryMessages: 0 },
  );
}
