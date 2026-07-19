import plivo from "plivo";
import { prisma } from "@itsolute/db";
import { env } from "../env.js";

// Plivo provisioning (spec §8 / §11.2). Wires a number to our webhooks so calls
// reach /webhooks/plivo/incoming + /hangup. Two operations:
//   - configureOwnedNumber: point a number you already own at our app (no cost)
//   - rentNumber: search + BUY a new number (a paid action — guarded, opt-in)
//
// Requires PLIVO_AUTH_ID/TOKEN + PLIVO_WEBHOOK_BASE_URL. Not exercised without
// credentials; renting is never done implicitly.

function client() {
  if (!env.plivoAuthId || !env.plivoAuthToken) {
    throw new Error("PLIVO_AUTH_ID / PLIVO_AUTH_TOKEN are required for provisioning");
  }
  return new plivo.Client(env.plivoAuthId, env.plivoAuthToken);
}

function webhookBase() {
  if (!env.plivoWebhookBaseUrl) throw new Error("PLIVO_WEBHOOK_BASE_URL is required");
  return env.plivoWebhookBaseUrl.replace(/\/$/, "");
}

/** Create (or reuse) a Plivo Application whose answer/hangup URLs are our webhooks. */
export async function ensureApplication(name: string): Promise<string> {
  const c = client();
  const base = webhookBase();
  const created = await c.applications.create(name, {
    answerUrl: `${base}/webhooks/plivo/incoming`,
    answerMethod: "POST",
    hangupUrl: `${base}/webhooks/plivo/hangup`,
    hangupMethod: "POST",
  });
  // SDK returns the new application id.
  return (created as any).appId ?? (created as any).api_id;
}

export interface ProvisionResult {
  e164: string;
  plivoAppId: string;
}

/**
 * Point an already-owned Plivo number at the tenant's application (our webhooks),
 * and persist the PlivoNumber row. No purchase.
 */
export async function configureOwnedNumber(tenantId: string, e164: string): Promise<ProvisionResult> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  const c = client();
  const appId = await ensureApplication(`connect-${tenant.slug}`);
  const bare = e164.replace(/^\+/, "");
  await c.numbers.update(bare, { appId });

  const record = await prisma.plivoNumber.upsert({
    where: { e164 },
    update: { tenantId, plivoAppId: appId, status: "active" },
    create: { tenantId, e164, plivoAppId: appId, status: "active" },
  });
  return { e164: record.e164, plivoAppId: appId };
}

/**
 * Rent a NEW number and wire it up. This BUYS a number (a paid action) — only
 * runs when explicitly confirmed by the caller. Left unexecuted without creds.
 */
export async function rentNumber(
  tenantId: string,
  opts: { country?: string; pattern?: string; confirm: boolean },
): Promise<ProvisionResult> {
  if (!opts.confirm) throw new Error("rentNumber requires explicit confirm:true (paid action)");
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  const c = client();
  const appId = await ensureApplication(`connect-${tenant.slug}`);

  const search: any = await c.numbers.search(opts.country ?? "IN", {
    ...(opts.pattern ? { pattern: opts.pattern } : {}),
    type: "fixed",
  });
  const candidate = search?.objects?.[0]?.number;
  if (!candidate) throw new Error("No matching numbers available to rent");

  await c.numbers.buy(candidate, appId);
  const e164 = candidate.startsWith("+") ? candidate : `+${candidate}`;

  const record = await prisma.plivoNumber.upsert({
    where: { e164 },
    update: { tenantId, plivoAppId: appId, status: "active" },
    create: { tenantId, e164, plivoAppId: appId, status: "active" },
  });
  return { e164: record.e164, plivoAppId: appId };
}
