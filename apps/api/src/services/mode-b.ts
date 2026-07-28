import { prisma } from "@itsolute/db";
import type { Tenant, Call, IvrNode } from "@itsolute/db";
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

/**
 * Produce the XML for whatever an IVR node's action says to do. Used for both
 * the root node (call entry) and a matched child, so a node behaves the same
 * wherever it sits. Only `submenu` collects a keypress — every other action
 * plays the node's prompt then proceeds. (The old code always issued a
 * GetDigits for the root regardless of its action, so a `ring_staff` root
 * waited for a keypress that never came and timed out.)
 */
async function runNodeAction(tenant: Tenant, call: Call, node: IvrNode): Promise<string> {
  switch (node.action) {
    case "submenu":
      // A menu: speak the prompt and wait for a DTMF digit.
      return ivrMenu(node.prompt, action("/webhooks/plivo/ivr", { u: call.plivoCallUuid ?? "", n: node.id }));
    case "ring_staff":
      // Speak the greeting/prompt, then go straight to the staff hunt — no keypress.
      return startHunt(tenant, call, 0, node.prompt);
    case "voicemail":
      return speakThenHangup(node.prompt || `${tenant.brandName}. Please leave a message after the tone.`);
    case "hangup":
    default:
      return node.prompt ? speakThenHangup(node.prompt) : hangup();
  }
}

/** Entry point for a Mode B call: run the IVR root if configured, else hunt. */
export async function startModeBCall(tenant: Tenant, call: Call): Promise<string> {
  const root = await prisma.ivrNode.findFirst({
    where: { tenantId: tenant.id, parentId: null },
    orderBy: { createdAt: "asc" },
  });
  if (root) {
    await appendRoute(call.id, { type: "ivr", nodeId: root.id });
    return runNodeAction(tenant, call, root);
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
  return runNodeAction(tenant, call, child);
}

/**
 * Caller ID for outbound legs to staff. It MUST be a Plivo number we OWN — the
 * DID the call came in on — NOT the external caller's number. Presenting a
 * number we don't own makes Plivo refuse to anchor media for the bridge and it
 * fails the leg with the hangup cause "Violates Media Anchoring". Falls back to
 * the tenant's active DID if the call didn't record which number it hit.
 */
async function ownedCallerId(call: Call): Promise<string | undefined> {
  if (call.plivoNumberId) {
    const n = await prisma.plivoNumber.findUnique({
      where: { id: call.plivoNumberId },
      select: { e164: true },
    });
    if (n?.e164) return n.e164;
  }
  const active = await prisma.plivoNumber.findFirst({
    where: { tenantId: call.tenantId, status: "active" },
    orderBy: { createdAt: "desc" },
    select: { e164: true },
  });
  return active?.e164 ?? undefined;
}

/**
 * Ring the staff member at `index`; if none, fall through to recovery.
 * `preamble` (spoken once before the first ring) lets a `ring_staff` node play
 * its greeting before dialing; hunt-to-next hops pass none so it isn't repeated.
 */
export async function startHunt(
  tenant: Tenant,
  call: Call,
  index: number,
  preamble?: string,
): Promise<string> {
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
    // Dial FROM our owned DID, not the caller's number — see ownedCallerId.
    callerId: await ownedCallerId(call),
    speakBefore: preamble,
  });
}

/**
 * Result of a dialed staff leg. Mark the call `answered` ONLY if a staff member
 * actually picked up — otherwise hunt to the next staff member (recording the
 * result on the current hop).
 *
 * "Answered" is decided by the staff B-leg having real connected duration
 * (`billableSec > 0`), NOT by Plivo's `DialStatus`. Plivo reports
 * DialStatus="completed" whenever the <Dial> element finishes — which also
 * happens when the caller hangs up during ringing before anyone picks up. Gating
 * on DialStatus would mark those abandoned calls "answered", hiding a lost lead
 * from the owner and skipping the WhatsApp recovery. A leg that isn't a real
 * pickup (no-answer, busy, or caller abandoned) stays `ringing`, so the hangup
 * webhook correctly logs it `missed` and fires recovery.
 */
export async function handleDialStatus(
  tenant: Tenant,
  call: Call,
  index: number,
  dialStatus: string,
  billableSec: number,
  recordingUrl?: string,
): Promise<string> {
  // annotate the current ring hop with its result (keep Plivo's raw status)
  const fresh = await prisma.call.findUnique({ where: { id: call.id }, select: { routePath: true } });
  const path = Array.isArray(fresh?.routePath) ? (fresh!.routePath as any[]) : [];
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i]?.type === "ring" && path[i].result === undefined) {
      path[i].result = dialStatus;
      break;
    }
  }

  const staffPickedUp = billableSec > 0; // the B-leg genuinely connected
  if (staffPickedUp) {
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

  // No pickup (no-answer/busy) or the caller abandoned — hunt to the next staff
  // member. If the caller has already hung up, this XML is moot and the hangup
  // webhook marks the call missed + enqueues recovery.
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
