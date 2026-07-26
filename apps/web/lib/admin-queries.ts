import { prisma, plans } from "@itsolute/db";
import { currentMonthRange } from "./tz";

// Admin reads span ALL tenants — the one context that legitimately crosses the
// tenant boundary. Uses the base client directly (never forTenant). Only ever
// reached behind requireAdminSession().

/** Monthly-recurring-revenue contribution of a tenant (₹), monthly-equivalent. */
export function mrrOf(plan: plans.PlanId, cycle: "monthly" | "annual", status: string): number {
  if (status !== "active") return 0;
  const p = plans.planFor(plan);
  return cycle === "annual" ? Math.round(p.monthly * p.annualMultiplier) : p.monthly;
}

export async function getAdminOverview() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      whatsappSenders: { orderBy: { createdAt: "desc" }, take: 1 },
      plivoNumbers: { where: { status: "active" }, take: 1 },
      _count: { select: { users: true } },
    },
  });

  // This-month usage per tenant (IST default range is fine for the summary).
  const { start, end } = currentMonthRange("Asia/Kolkata");
  const usage = await prisma.usageDaily.groupBy({
    by: ["tenantId"],
    where: { date: { gte: start, lte: end } },
    _sum: { recoveryMessages: true, minutes: true },
  });
  const usageByTenant = new Map(usage.map((u) => [u.tenantId, u._sum]));

  const rows = tenants.map((t) => {
    const sender = t.whatsappSenders[0];
    const u = usageByTenant.get(t.id);
    return {
      id: t.id,
      slug: t.slug,
      brandName: t.brandName,
      mode: t.mode,
      plan: t.plan,
      status: t.status,
      billingCycle: t.billingCycle,
      whatsapp: sender ? { status: sender.status, quality: sender.qualityRating } : null,
      hasNumber: t.plivoNumbers.length > 0,
      users: t._count.users,
      messages: u?.recoveryMessages ?? 0,
      minutes: u?.minutes ?? 0,
      mrr: mrrOf(t.plan, t.billingCycle, t.status),
    };
  });

  const totalMrr = rows.reduce((s, r) => s + r.mrr, 0);
  const activeCount = rows.filter((r) => r.status === "active").length;
  return { rows, totalMrr, activeCount, tenantCount: rows.length };
}

export async function getTenantAdmin(id: string) {
  return prisma.tenant.findUnique({
    where: { id },
    include: {
      whatsappSenders: { orderBy: { createdAt: "desc" } },
      plivoNumbers: { orderBy: { createdAt: "desc" } },
      users: { orderBy: { createdAt: "asc" } },
      templates: { orderBy: [{ createdAt: "desc" }] },
      // Mode B routing config (read-only view for admins).
      staff: { orderBy: { ringOrder: "asc" } },
      ivrNodes: { orderBy: { createdAt: "asc" } },
      // Recent activity.
      calls: { orderBy: { startedAt: "desc" }, take: 30 },
      recoveryMessages: { orderBy: { createdAt: "desc" }, take: 25 },
    },
  });
}

/** This-month usage rollup for one tenant (messages + Mode B minutes). */
export async function getTenantMonthUsage(tenantId: string, timezone: string) {
  const { start, end } = currentMonthRange(timezone || "Asia/Kolkata");
  const agg = await prisma.usageDaily.aggregate({
    where: { tenantId, date: { gte: start, lte: end } },
    _sum: { recoveryMessages: true, minutes: true },
  });
  return { messages: agg._sum.recoveryMessages ?? 0, minutes: agg._sum.minutes ?? 0 };
}

/** Every user across all tenants (plus internal admins). */
export async function getAllUsers() {
  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "asc" }],
    include: { tenant: { select: { slug: true, brandName: true } } },
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
    tenantId: u.tenantId,
    tenantName: u.tenant?.brandName ?? null,
    tenantSlug: u.tenant?.slug ?? null,
  }));
}

/** Every Plivo number Connect knows about — the provisioning history. */
export async function getAllNumbers() {
  const numbers = await prisma.plivoNumber.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { tenant: { select: { id: true, slug: true, brandName: true } }, _count: { select: { calls: true } } },
  });
  return numbers.map((n) => ({
    id: n.id,
    e164: n.e164,
    plivoAppId: n.plivoAppId,
    status: n.status, // active | released
    createdAt: n.createdAt,
    tenantId: n.tenantId,
    tenantName: n.tenant?.brandName ?? "—",
    tenantSlug: n.tenant?.slug ?? null,
    calls: n._count.calls,
  }));
}

export async function getAdminTemplates() {
  const [templates, tenants] = await Promise.all([
    prisma.template.findMany({ orderBy: [{ tenantId: "asc" }, { name: "asc" }] }),
    prisma.tenant.findMany({ select: { id: true, brandName: true } }),
  ]);
  const nameById = new Map(tenants.map((t) => [t.id, t.brandName]));
  return templates.map((t) => ({ ...t, tenantName: t.tenantId ? nameById.get(t.tenantId) ?? "—" : "Shared default" }));
}

export async function getAdminUsage() {
  const { start, end } = currentMonthRange("Asia/Kolkata");
  const [usage, tenants] = await Promise.all([
    prisma.usageDaily.groupBy({
      by: ["tenantId"],
      where: { date: { gte: start, lte: end } },
      _sum: { recoveryMessages: true, minutes: true },
    }),
    prisma.tenant.findMany({ select: { id: true, brandName: true, plan: true } }),
  ]);
  const byId = new Map(tenants.map((t) => [t.id, t]));
  return usage.map((u) => {
    const t = byId.get(u.tenantId);
    const plan = t ? plans.planFor(t.plan) : null;
    const messages = u._sum.recoveryMessages ?? 0;
    const minutes = u._sum.minutes ?? 0;
    return {
      tenantId: u.tenantId,
      brandName: t?.brandName ?? "—",
      messages,
      minutes,
      includedMessages: plan?.includedRecoveryMessages ?? 0,
      includedMinutes: plan?.includedMinutes ?? 0,
    };
  });
}
