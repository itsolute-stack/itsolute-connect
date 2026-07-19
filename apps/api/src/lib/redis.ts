import { Redis } from "ioredis";
import { env } from "../env.js";

// Shared Redis connection for BullMQ. BullMQ requires `maxRetriesPerRequest: null`
// on the connection it uses for blocking commands. Created lazily so the API can
// boot (and step-2 webhooks work) without Redis in development.

let connection: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.redisUrl) return null;
  if (!connection) {
    connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
    connection.on("error", (err) => console.error("[redis] connection error:", err.message));
  }
  return connection;
}

export async function closeRedis(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
