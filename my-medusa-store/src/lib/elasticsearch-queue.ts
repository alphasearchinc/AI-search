import { Queue } from "bullmq";
import { createRedisConnection } from "./redis-connection";

export const PRODUCT_EMBEDDING_QUEUE = "product-embedding";

const connection = createRedisConnection("QUEUE");

export type ProductEmbeddingJobData = {
  product_id: string;
  embedded_text: string;
  embedding_vector: number[];
  metadata?: Record<string, any>;
};

export const productEmbeddingQueue = new Queue<ProductEmbeddingJobData>(
  PRODUCT_EMBEDDING_QUEUE,
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: 100,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  }
);

console.log(`[QUEUE] 📦 Queue "${PRODUCT_EMBEDDING_QUEUE}" initialized`);
