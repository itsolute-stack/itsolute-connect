import { forTenant } from "@itsolute/db";
import { currentMonthRange } from "./tz";

export async function getStaff(tenantId: string) {
  return forTenant(tenantId).staff.findMany({ orderBy: { ringOrder: "asc" } });
}

export async function getIvrNodes(tenantId: string) {
  return forTenant(tenantId).ivrNode.findMany({ orderBy: [{ parentId: "asc" }, { key: "asc" }] });
}

// Mode B call analytics for the current month (spec §7.5).
export async function getCallAnalytics(tenantId: string, timeZone: string) {
  const db = forTenant(tenantId);
  const { start, end } = currentMonthRange(timeZone);
  const calls = await db.call.findMany({
    where: { startedAt: { gte: start, lte: end } },
    select: { status: true, billableSec: true },
  });

  const total = calls.length;
  const answered = calls.filter((c) => c.status === "answered").length;
  const missed = calls.filter((c) => c.status === "missed" || c.status === "recovered").length;
  const recovered = calls.filter((c) => c.status === "recovered").length;
  const answeredSecs = calls.filter((c) => c.status === "answered").map((c) => c.billableSec);
  const avgHandleSec = answeredSecs.length
    ? Math.round(answeredSecs.reduce((a, b) => a + b, 0) / answeredSecs.length)
    : 0;

  return {
    total,
    answered,
    missed,
    recovered,
    answerRate: total ? answered / total : 0,
    missedRate: total ? missed / total : 0,
    avgHandleSec,
  };
}
