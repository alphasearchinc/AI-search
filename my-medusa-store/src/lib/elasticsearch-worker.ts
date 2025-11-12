// src/lib/elasticsearch-worker.ts
// BullMQ worker for processing Elasticsearch indexing jobs

import { Worker, Job } from "bullmq";
import { createRedisConnection } from "./redis-connection";
import { elasticsearchClient } from "../modules/elasticsearch-client";

const QUEUE_NAME = "elasticsearch-indexing";

// Create Redis connection
const connection = createRedisConnection("WORKER");

// Job data interface
interface JobData {
  action: "index" | "update" | "delete";
  entity: string;
  data: {
    id: string;
    title?: string;
    description?: string;
    price?: number;
    [key: string]: any;
  };
}

/**
 * Main job processor
 */
async function processJob(job: Job<JobData>): Promise<void> {
  const { action, entity, data } = job.data;

  console.log(`[WORKER] 🎯 Processing job ${job.id}: ${action} for ${entity}:${data.id}`);

  switch (action) {
    case "index":
    case "update":
      // Use index for both - it will create if missing, update if exists
      await elasticsearchClient.index({
        index: entity,
        id: data.id,
        document: data,
      });
      console.log(`[WORKER] ✅ Document ${action === "index" ? "indexed" : "updated"}: ${entity}:${data.id}`);
      break;

    case "delete":
      await elasticsearchClient.delete({
        index: entity,
        id: data.id,
      });
      console.log(`[WORKER] ✅ Document deleted: ${entity}:${data.id}`);
      break;

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// Create worker
const worker = new Worker<JobData>(QUEUE_NAME, processJob, {
  connection,
  concurrency: 5,
});

// Event handlers
worker.on("ready", () => {
  console.log(`[WORKER] ✅ Worker ready`);
});

worker.on("completed", (job) => {
  console.log(`[WORKER] ✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[WORKER] ❌ Job ${job?.id} failed:`, err.message);
});

export default worker;
