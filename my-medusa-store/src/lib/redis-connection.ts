import Redis from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);

/**
 * Creates a Redis connection for BullMQ queues/workers
 */
export function createRedisConnection(label: string): Redis {
  const connection = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null,
  });

  connection.on("connect", () => {
    console.log(`[${label}] ✅ Redis connected`);
  });

  connection.on("error", (err) => {
    console.error(`[${label}] ❌ Redis error:`, err.message);
  });

  return connection;
}
