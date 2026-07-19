import type { Request } from "express";
import plivoPkg from "plivo";
import { env } from "../env.js";

// Plivo Signature V3 verification — delegated to Plivo's own validator so the
// algorithm is exactly theirs (base is `url + '.' + nonce`; for POST it also
// folds in the sorted request body params, with a base64 round-trip). Rolling
// this by hand is a footgun: an incorrect formula still passes a self-signed
// test but rejects every real Plivo request.
//
// The X-Plivo-Signature-V3 header may carry multiple comma-separated signatures
// (one per redirect URL); validateV3Signature handles that internally.

const validateV3Signature = (
  plivoPkg as unknown as {
    validateV3Signature: (
      method: string,
      uri: string,
      nonce: string,
      authToken: string,
      signature: string,
      params?: Record<string, unknown>,
    ) => boolean;
  }
).validateV3Signature;

const SIG_HEADER = "x-plivo-signature-v3";
const NONCE_HEADER = "x-plivo-signature-v3-nonce";

function firstHeader(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

/** Reconstruct the exact URL Plivo requested. Prefer the configured base so it
 *  survives Railway's proxy; must match the answer/hangup URL on the Plivo app. */
function requestedUrl(req: Request): string {
  if (env.plivoWebhookBaseUrl) {
    return env.plivoWebhookBaseUrl.replace(/\/$/, "") + req.originalUrl;
  }
  const proto = (firstHeader(req, "x-forwarded-proto") ?? req.protocol).split(",")[0].trim();
  const host = firstHeader(req, "x-forwarded-host") ?? req.get("host") ?? "";
  return `${proto}://${host}${req.originalUrl}`;
}

export type SignatureResult = { ok: true; reason?: never } | { ok: false; reason: string };

export function verifyPlivoV3(req: Request): SignatureResult {
  if (env.plivoSkipSignature) return { ok: true };
  if (!env.plivoAuthToken) {
    return { ok: false, reason: "PLIVO_AUTH_TOKEN not configured" };
  }

  const signature = firstHeader(req, SIG_HEADER);
  const nonce = firstHeader(req, NONCE_HEADER);
  if (!signature || !nonce) return { ok: false, reason: "missing signature/nonce headers" };

  const url = requestedUrl(req);
  try {
    const ok = validateV3Signature(
      req.method,
      url,
      nonce,
      env.plivoAuthToken,
      signature,
      (req.body ?? {}) as Record<string, unknown>,
    );
    // Include the reconstructed URL in the failure reason — a mismatch is almost
    // always a wrong PLIVO_AUTH_TOKEN or a URL that doesn't equal the Plivo app's
    // answer/hangup URL (e.g. PLIVO_WEBHOOK_BASE_URL off by a slash or scheme).
    return ok ? { ok: true } : { ok: false, reason: `signature mismatch (url=${url})` };
  } catch (e) {
    return { ok: false, reason: `validation error: ${(e as Error).message}` };
  }
}
