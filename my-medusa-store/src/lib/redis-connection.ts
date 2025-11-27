import Redis from "ioredis";

const DEFAULT_REDIS_URL =
  process.env.REDIS_URL ||
  `redis://${process.env.REDIS_HOST || "redis"}:${process.env.REDIS_PORT || "6379"}`;

/**
 * Creates a Redis connection for BullMQ queues/workers
 */
export function createRedisConnection(label: string): Redis {
  const connection = new Redis(DEFAULT_REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  connection.on("connect", () => {
    console.log(`[${label}] ✅ Redis connected to ${DEFAULT_REDIS_URL}`);
  });

  connection.on("error", (err) => {
    console.error(`[${label}] ❌ Redis error:`, err);
  });

  return connection;
}
