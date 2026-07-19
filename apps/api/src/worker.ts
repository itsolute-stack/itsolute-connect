import { env } from "./env.js";
import { createRecoveryWorker } from "./workers/recovery.js";
import { startWaSubscriber } from "./ws/wa-subscriber.js";
import { startReconciliationLoop } from "./workers/reconcile.js";
import { closeRedis } from "./lib/redis.js";

// Separate worker process (Railway runs this alongside the API). It runs three
// things: the BullMQ recovery worker (sends), the WhatsApp WebSocket subscriber
// (real-time status/reply), and the reconciliation poll (gap-filling backstop).
if (!env.redisUrl) {
  console.error("[worker] REDIS_URL is not set — cannot start workers.");
  process.exit(1);
}

const worker = createRecoveryWorker();
console.log("[worker] recovery worker started");

const subscriber = await startWaSubscriber();
const reconciler = startReconciliationLoop();

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    console.log(`[worker] ${sig} received, shutting down`);
    reconciler.stop();
    subscriber.stop();
    await worker.close();
    await closeRedis();
    process.exit(0);
  });
}
