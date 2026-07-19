import crypto from "node:crypto";
import type { Request } from "express";
import { env } from "../env.js";

// Plivo Signature V3 verification.
//
//   signature = base64( HMAC-SHA256( authToken, url + nonce ) )
//
// where `url` is the exact URL Plivo requested. The X-Plivo-Signature-V3 header
// may carry multiple comma-separated signatures (one per redirect URL) — a match
// against any one is valid. V3 does NOT sign the POST body, so we don't need the
// raw body here.

const SIG_HEADER = "x-plivo-signature-v3";
const NONCE_HEADER = "x-plivo-signature-v3-nonce";

function firstHeader(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

/** Reconstruct the exact URL Plivo used. Prefer configured base to survive proxies. */
function requestedUrl(req: Request): string {
  if (env.plivoWebhookBaseUrl) {
    return env.plivoWebhookBaseUrl.replace(/\/$/, "") + req.originalUrl;
  }
  const proto = (firstHeader(req, "x-forwarded-proto") ?? req.protocol).split(",")[0].trim();
  const host = firstHeader(req, "x-forwarded-host") ?? req.get("host") ?? "";
  return `${proto}://${host}${req.originalUrl}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export type SignatureResult =
  | { ok: true; reason?: never }
  | { ok: false; reason: string };

export function verifyPlivoV3(req: Request): SignatureResult {
  if (env.plivoSkipSignature) return { ok: true };
  if (!env.plivoAuthToken) {
    return { ok: false, reason: "PLIVO_AUTH_TOKEN not configured" };
  }

  const signatures = firstHeader(req, SIG_HEADER);
  const nonce = firstHeader(req, NONCE_HEADER);
  if (!signatures || !nonce) return { ok: false, reason: "missing signature/nonce headers" };

  const url = requestedUrl(req);
  const expected = crypto
    .createHmac("sha256", env.plivoAuthToken)
    .update(url + nonce)
    .digest("base64");

  const provided = signatures.split(",").map((s) => s.trim());
  const match = provided.some((sig) => timingSafeEqual(sig, expected));
  return match ? { ok: true } : { ok: false, reason: "signature mismatch" };
}
