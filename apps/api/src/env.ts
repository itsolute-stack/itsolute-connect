// Load .env (Node 24 built-in) before anything reads process.env. No dotenv dep.
try {
  process.loadEnvFile();
} catch {
  // no .env file present (e.g. production injects env vars directly) — fine.
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "4000")),

  // Postgres — @itsolute/db reads DATABASE_URL directly; asserted here so we
  // fail fast at boot rather than on first query.
  databaseUrl: required("DATABASE_URL"),

  // Plivo (voice). Auth token verifies inbound webhook signatures AND authorizes
  // provisioning API calls (renting/configuring numbers).
  plivoAuthId: optional("PLIVO_AUTH_ID"),
  plivoAuthToken: optional("PLIVO_AUTH_TOKEN"),

  // Public base URL Plivo uses to reach these webhooks (scheme+host, no trailing
  // slash), e.g. https://api.itsolute.com. Needed to reconstruct the exact URL
  // for V3 signature verification when running behind a proxy (Railway).
  plivoWebhookBaseUrl: optional("PLIVO_WEBHOOK_BASE_URL"),

  // Escape hatch for local testing without valid Plivo signatures.
  plivoSkipSignature: optional("PLIVO_SKIP_SIGNATURE") === "true",

  // Redis / BullMQ. When unset in development, the recovery queue no-ops so the
  // webhook flow still works without a local Redis. Required in production.
  redisUrl: optional("REDIS_URL"),

  // Existing WhatsApp platform (internal send API). Auth is an x-webhook-secret
  // header matching the platform's INTERNAL_WEBHOOK_SECRET. The send endpoint is
  // POST /api/notify/custom. When base URL is unset, the WA client runs in mock
  // mode (logs + returns a fake message id) so dev works without the platform.
  waPlatformBaseUrl: optional("WA_PLATFORM_BASE_URL"),
  waPlatformSecret: optional("WA_PLATFORM_SECRET"),
  waPlatformSendPath: optional("WA_PLATFORM_SEND_PATH", "/api/notify/custom"),

  // Inbound status/reply ingestion (spec §4a.6–7). The platform doesn't push to
  // us, so we (a) subscribe to its WebSocket for real-time updates and (b) poll
  // its REST API to reconcile anything missed during a disconnect — matched by
  // waMessageId. WS needs no auth; REST needs a platform login (JWT).
  waPlatformWsUrl: optional("WA_PLATFORM_WS_URL"), // e.g. wss://wa.host/ws
  waPlatformUserEmail: optional("WA_PLATFORM_USER_EMAIL"),
  waPlatformUserPassword: optional("WA_PLATFORM_USER_PASSWORD"),
  reconcileIntervalMs: Number(optional("RECONCILE_INTERVAL_MS", "180000")), // 3 min
  reconcileWindowHours: Number(optional("RECONCILE_WINDOW_HOURS", "72")),
} as const;

export function isProd() {
  return env.nodeEnv === "production";
}
