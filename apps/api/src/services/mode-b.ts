import { prisma } from "@itsolute/db";
import type { Tenant, Call } from "@itsolute/db";
import { env } from "../env.js";
import { ivrMenu, dialStaff, speakThenHangup, hangup } from "../lib/plivo-xml.js";
import { localDateYmd } from "../lib/business-hours.js";

// Mode B (Front Desk) call routing (spec §4b). A call is walked through an
// optional IVR menu, then staff are rung in ring_order with busy/no-answer
// hunting to the next number. Every hop is appended to Call.routePath. If nobody
// answers, the call falls through to the same recovery flow as Mode A.
//
// Plivo call control is multi-step: each XML response drives the next leg, and
// Plivo POSTs the result back to an action URL. We keep the hunt index + node in
// the action URL query so the flow stays stateless between callbacks.

function webhookBase(): string {
  return (env.plivoWebhookBaseUrl || "").replace(/\/$/, "");
}

function action(path: string, params: Record<string, string | number>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) sp.set(k, String(v));
  return `${webhookBase()}${path}?${sp.toString()}`;
}

type RouteHop =
  | { type: "ivr"; nodeId: string; key?: string }
  | { type: "ring"; staffId: string; e164: string; order: number; result?: string };

async function appendRoute(callId: string, hop: RouteHop) {
  const call = await prisma.call.findUnique({ where: { id: callId }, select: { routePath: true } });
  const path = Array.isArray(call?.routePath) ? (call!.routePath as unknown[]) : [];
  path.push(hop);
  await prisma.call.update({ where: { id: callId }, data: { routePath: path as object[] } });
}

async function staffInOrder(tenantId: string) {
  return prisma.staff.findMany({ where: { tenantId }, orderBy: { ringOrder: "asc" } });
}

/** Entry point for a Mode B call: IVR root if configured, else start the hunt. */
export async function startModeBCall(tenant: Tenant, call: Call): Promise<string> {
  const root = await prisma.ivrNode.findFirst({
    where: { tenantId: tenant.id, parentId: null },
    orderBy: { createdAt: "asc" },
  });
  if (root) {
    await appendRoute(call.id, { type: "ivr", nodeId: root.id });
    return ivrMenu(root.prompt, action("/webhooks/plivo/ivr", { u: call.plivoCallUuid ?? "", n: root.id }));
  }
  return startHunt(tenant, call, 0);
}

/** Handle a DTMF digit at an IVR node. */
export async function handleIvrInput(
  tenant: Tenant,
  call: Call,
  nodeId: string,
  digit: string,
): Promise<string> {
  const child = await prisma.ivrNode.findFirst({ where: { tenantId: tenant.id, parentId: nodeId, key: digit } });
  if (!child) {
    // invalid choice → hunt to staff as a safe default
    return startHunt(tenant, call, 0);
  }
  await appendRoute(call.id, { type: "ivr", nodeId: child.id, key: digit });

  switch (child.action) {
    case "submenu":
      return ivrMenu(child.prompt, action("/webhooks/plivo/ivr", { u: call.plivoCallUuid ?? "", n: child.id }));
    case "ring_staff":
      return startHunt(tenant, call, 0);
    case "voicemail":
      return speakThenHangup(`${tenant.brandName}. Please leave a message after the tone.`);
    case "hangup":
    default:
      return hangup();
  }
}

/** Ring the staff member at `index`; if none, fall through to recovery. */
export async function startHunt(tenant: Tenant, call: Call, index: number): Promise<string> {
  const staff = await staffInOrder(tenant.id);
  if (index >= staff.length) {
    // Nobody available → recovery flow (hangup webhook marks missed + enqueues).
    return speakThenHangup(
      `Sorry we missed your call at ${tenant.brandName}. We'll message you on WhatsApp right now.`,
    );
  }
  const s = staff[index];
  await appendRoute(call.id, { type: "ring", staffId: s.id, e164: s.e164, order: s.ringOrder });
  return dialStaff(s.e164, action("/webhooks/plivo/dial-status", { u: call.plivoCallUuid ?? "", i: index }), {
    timeoutSec: 20,
    record: tenant.recordCalls,
    callerId: call.callerE164,
  });
}

const ANSWERED = new Set(["completed", "answered"]);

/**
 * Result of a dialed leg. If answered, mark the call answered. Otherwise hunt to
 * the next staff member (recording the result on the current hop).
 */
export async function handleDialStatus(
  tenant: Tenant,
  call: Call,
  index: number,
  dialStatus: string,
  billableSec: number,
  recordingUrl?: string,
): Promise<string> {
  // annotate the current ring hop with its result
  const fresh = await prisma.call.findUnique({ where: { id: call.id }, select: { routePath: true } });
  const path = Array.isArray(fresh?.routePath) ? (fresh!.routePath as any[]) : [];
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i]?.type === "ring" && path[i].result === undefined) {
      path[i].result = dialStatus;
      break;
    }
  }

  if (ANSWERED.has(dialStatus.toLowerCase())) {
    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: "answered",
        answeredAt: call.answeredAt ?? new Date(),
        billableSec: Math.max(call.billableSec, billableSec),
        routePath: path as object[],
        ...(recordingUrl ? { recordingUrl } : {}),
      },
    });
    return hangup(); // bridged leg ended; release the call
  }

  await prisma.call.update({ where: { id: call.id }, data: { routePath: path as object[] } });
  return startHunt(tenant, call, index + 1);
}

/** Roll a call's billable seconds into the daily usage rollup (Mode B minutes). */
export async function meterCallMinutes(tenantId: string, billableSec: number, timeZone: string, now = new Date()) {
  if (billableSec <= 0) return;
  const minutes = Math.ceil(billableSec / 60); // telecom bills per started minute
  const date = new Date(`${localDateYmd(now, timeZone)}T00:00:00.000Z`);
  await prisma.usageDaily.upsert({
    where: { tenantId_date: { tenantId, date } },
    create: { tenantId, date, minutes },
    update: { minutes: { increment: minutes } },
  });
}
