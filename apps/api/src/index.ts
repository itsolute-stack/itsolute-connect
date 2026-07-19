import { env } from "./env.js";
import { createApp } from "./app.js";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[api] listening on :${env.port} (${env.nodeEnv})`);
  if (!env.plivoAuthToken && !env.plivoSkipSignature) {
    console.warn(
      "[api] PLIVO_AUTH_TOKEN not set — Plivo webhooks will be REJECTED. " +
        "Set it, or PLIVO_SKIP_SIGNATURE=true for local testing.",
    );
  }
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`[api] ${sig} received, shutting down`);
    server.close(() => process.exit(0));
  });
}
