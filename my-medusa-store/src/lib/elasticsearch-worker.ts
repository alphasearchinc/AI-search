import { Worker, Job } from "bullmq";
import { createRedisConnection } from "./redis-connection";
import {
  elasticsearchClient,
  PRODUCT_EMBEDDINGS_INDEX,
} from "../modules/elasticsearch-client";
import { ProductEmbeddingJobData, PRODUCT_EMBEDDING_QUEUE } from "./elasticsearch-queue";

const connection = createRedisConnection("WORKER");

async function processEmbeddingJob(job: Job<ProductEmbeddingJobData>) {
  const { product_id, embedded_text, embedding_vector, metadata } = job.data;

  await elasticsearchClient.index({
    index: PRODUCT_EMBEDDINGS_INDEX,
    id: product_id,
    document: {
      product_id,
      embedded_text,
      embedding_vector,
      metadata: metadata || {},
      generated_at: new Date().toISOString(),
    },
  });

  console.log(
    `[WORKER] ✅ Indexed embedding for product ${product_id} (job ${job.id})`
  );
}

const worker = new Worker<ProductEmbeddingJobData>(
  PRODUCT_EMBEDDING_QUEUE,
  processEmbeddingJob,
  {
    connection,
    concurrency: 5,
  }
);

worker.on("ready", () => {
  console.log(`[WORKER] ✅ Worker ready`);
});

worker.on("completed", (job) => {
  console.log(`[WORKER] ✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[WORKER] ❌ Job ${job?.id} failed: ${err.message}`);
});

export default worker;
