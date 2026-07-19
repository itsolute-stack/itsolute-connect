import { Queue } from "bullmq";
import { getRedis } from "../lib/redis.js";
import { isProd } from "../env.js";

// Recovery-job producer. The webhook layer calls enqueueRecovery(); the worker
// (workers/recovery.ts) consumes from the same queue. Cooldown + quiet-hours
// policy lives in the worker so all recovery decisions are in one place.

export const RECOVERY_QUEUE = "recovery";

export interface RecoveryJob {
  tenantId: string;
  callId: string;
  callerE164: string;
}

let queue: Queue<RecoveryJob> | null = null;

export function getRecoveryQueue(): Queue<RecoveryJob> | null {
  const connection = getRedis();
  if (!connection) return null;
  if (!queue) {
    queue = new Queue<RecoveryJob>(RECOVERY_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }
  return queue;
}

export async function enqueueRecovery(
  job: RecoveryJob,
  opts?: { delayMs?: number; jobId?: string },
): Promise<void> {
  const q = getRecoveryQueue();
  if (!q) {
    if (isProd()) throw new Error("REDIS_URL is required in production for the recovery queue");
    console.warn(`[recovery] REDIS_URL unset — skipping enqueue (dev) for call=${job.callId}`);
    return;
  }
  // Default de-dupe: one recovery job per call, even on webhook retries. A
  // quiet-hours deferral re-enqueues with a distinct jobId (the original job is
  // still active, so BullMQ would reject a duplicate id).
  await q.add(RECOVERY_QUEUE, job, {
    jobId: opts?.jobId ?? `call:${job.callId}`,
    delay: opts?.delayMs && opts.delayMs > 0 ? opts.delayMs : undefined,
  });
}
