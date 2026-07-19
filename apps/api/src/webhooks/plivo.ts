import { Router, type Request, type Response } from "express";
import { prisma } from "@itsolute/db";
import { normalizeE164 } from "../lib/phone.js";
import { speakThenHangup, hangup } from "../lib/plivo-xml.js";
import { verifyPlivoV3 } from "../lib/plivo-signature.js";
import { asyncHandler } from "../lib/async-handler.js";
import { enqueueRecovery } from "../queues/recovery.js";
import {
  startModeBCall,
  handleIvrInput,
  handleDialStatus,
  meterCallMinutes,
} from "../services/mode-b.js";

export const plivoWebhooks = Router();

const XML = (res: Response, body: string, status = 200) =>
  res.status(status).type("application/xml").send(body);

// Reject any request whose Plivo V3 signature doesn't verify. Applied to every
// route in this router. Calls are the trust boundary — never act on an unsigned
// webhook in production.
plivoWebhooks.use((req, res, next) => {
  const result = verifyPlivoV3(req);
  if (!result.ok) {
    console.warn(`[plivo] rejected webhook ${req.path}: ${result.reason}`);
    return XML(res, hangup(), 403);
  }
  next();
});

async function resolveTenantByDialedNumber(toRaw: string | undefined) {
  const e164 = normalizeE164(toRaw);
  if (!e164) return null;
  return prisma.plivoNumber.findFirst({
    where: { e164, status: "active" },
    include: { tenant: true },
  });
}

// ---------------------------------------------------------------------------
// POST /webhooks/plivo/incoming — call reached the Plivo number.
// Mode A: the call is already a missed call (conditional forwarding). Record it,
// speak a branded line, hang up. The hangup_url fires separately at call end.
// ---------------------------------------------------------------------------
plivoWebhooks.post("/incoming", asyncHandler(async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const callUuid: string | undefined = body.CallUUID;
  const fromE164 = normalizeE164(body.From);

  const plivoNumber = await resolveTenantByDialedNumber(body.To);
  if (!plivoNumber) {
    console.warn(`[plivo] incoming for unprovisioned number To=${body.To} CallUUID=${callUuid}`);
    return XML(res, hangup());
  }

  const tenant = plivoNumber.tenant;

  let call = null;
  if (callUuid && fromE164) {
    // Idempotent on retries: the same CallUUID must not create a second row.
    call = await prisma.call.upsert({
      where: { plivoCallUuid: callUuid },
      update: {},
      create: {
        tenantId: tenant.id,
        plivoNumberId: plivoNumber.id,
        callerE164: fromE164,
        direction: "inbound",
        status: "ringing",
        plivoCallUuid: callUuid,
        raw: body,
      },
    });
  } else {
    console.warn(`[plivo] incoming missing CallUUID/From (To=${body.To})`);
  }

  // Mode B (Front Desk): route through IVR / staff hunt. Mode A: the call is
  // already missed → speak a branded line and hang up.
  if (tenant.mode === "B" && call) {
    return XML(res, await startModeBCall(tenant, call));
  }

  const line =
    `Sorry we missed your call at ${tenant.brandName}. ` +
    `We'll message you on WhatsApp right now. Thank you.`;
  return XML(res, speakThenHangup(line));
}));

// ---------------------------------------------------------------------------
// POST /webhooks/plivo/hangup — call ended. Mark missed, close out timing,
// and enqueue the recovery message (Mode A). Idempotent per CallUUID.
// ---------------------------------------------------------------------------
plivoWebhooks.post("/hangup", asyncHandler(async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const callUuid: string | undefined = body.CallUUID;
  const durationSec = Number.parseInt(body.Duration ?? "0", 10) || 0;
  const billableSec = Number.parseInt(body.BillDuration ?? body.Duration ?? "0", 10) || 0;

  let call = callUuid
    ? await prisma.call.findUnique({ where: { plivoCallUuid: callUuid } })
    : null;

  // Race: hangup arrived before /incoming recorded the call. Reconstruct it.
  if (!call) {
    const plivoNumber = await resolveTenantByDialedNumber(body.To);
    const fromE164 = normalizeE164(body.From);
    if (!plivoNumber || !fromE164 || !callUuid) {
      console.warn(`[plivo] hangup could not resolve call (CallUUID=${callUuid} To=${body.To})`);
      return res.status(200).end();
    }
    call = await prisma.call.create({
      data: {
        tenantId: plivoNumber.tenantId,
        plivoNumberId: plivoNumber.id,
        callerE164: fromE164,
        direction: "inbound",
        status: "ringing",
        plivoCallUuid: callUuid,
        raw: body,
      },
    });
  }

  // Only the first hangup transitions ringing → missed and enqueues recovery.
  // Answered/recovered calls (Mode B, later) are left untouched here.
  const shouldRecover = call.status === "ringing";
  if (shouldRecover) {
    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: "missed",
        endedAt: new Date(),
        durationSec,
        billableSec,
      },
    });
    await enqueueRecovery({
      tenantId: call.tenantId,
      callId: call.id,
      callerE164: call.callerE164,
    });
  }

  // Mode B: meter connected minutes into the daily usage rollup (spec §4b.4).
  const tenant = await prisma.tenant.findUnique({ where: { id: call.tenantId } });
  if (tenant?.mode === "B") {
    const sec = Math.max(call.billableSec, billableSec);
    if (sec > 0) {
      if (sec !== call.billableSec) {
        await prisma.call.update({ where: { id: call.id }, data: { billableSec: sec } });
      }
      await meterCallMinutes(tenant.id, sec, tenant.timezone);
    }
  }

  return res.status(200).end();
}));

// ---------------------------------------------------------------------------
// POST /webhooks/plivo/ivr — Mode B DTMF handling. Resolve the pressed digit
// against the IVR node and return the next step.
// ---------------------------------------------------------------------------
plivoWebhooks.post("/ivr", asyncHandler(async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const callUuid = (req.query.u as string) || body.CallUUID;
  const nodeId = req.query.n as string;
  const digit = String(body.Digits ?? "");

  const call = callUuid ? await prisma.call.findUnique({ where: { plivoCallUuid: callUuid } }) : null;
  if (!call || !nodeId) return XML(res, hangup());
  const tenant = await prisma.tenant.findUnique({ where: { id: call.tenantId } });
  if (!tenant) return XML(res, hangup());

  return XML(res, await handleIvrInput(tenant, call, nodeId, digit));
}));

// ---------------------------------------------------------------------------
// POST /webhooks/plivo/dial-status — result of a dialed staff leg (Mode B).
// Answered → mark answered; busy/no-answer → hunt to the next staff member.
// ---------------------------------------------------------------------------
plivoWebhooks.post("/dial-status", asyncHandler(async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const callUuid = (req.query.u as string) || body.CallUUID;
  const index = Number(req.query.i ?? 0) || 0;
  const dialStatus = String(body.DialStatus ?? body.DialBLegStatus ?? "");
  const billableSec =
    Number.parseInt(body.DialBLegBillDuration ?? body.DialBLegDuration ?? "0", 10) || 0;
  const recordingUrl = body.DialBLegRecordUrl || body.RecordUrl || undefined;

  const call = callUuid ? await prisma.call.findUnique({ where: { plivoCallUuid: callUuid } }) : null;
  if (!call) return XML(res, hangup());
  const tenant = await prisma.tenant.findUnique({ where: { id: call.tenantId } });
  if (!tenant) return XML(res, hangup());

  return XML(res, await handleDialStatus(tenant, call, index, dialStatus, billableSec, recordingUrl));
}));
