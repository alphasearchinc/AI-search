// src/lib/elasticsearch-queue.ts
// BullMQ queue for Elasticsearch indexing jobs

import { Queue } from "bullmq";
import { createRedisConnection } from "./redis-connection";

const QUEUE_NAME = "elasticsearch-indexing";

// Create Redis connection
const connection = createRedisConnection("QUEUE");

// Create the queue
export const elasticsearchQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

console.log(`[QUEUE] 📦 Queue "${QUEUE_NAME}" initialized`);
