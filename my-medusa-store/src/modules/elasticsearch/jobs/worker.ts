import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../../../lib/redis-connection";
import { ProductEmbeddingJobData } from "../types";
import { IndexManager } from "../services/index-manager";

export class ElasticsearchWorker {
  private worker: Worker<ProductEmbeddingJobData> | null = null;
  private queueName: string;
  private indexManager: IndexManager;

  constructor(queueName: string, indexManager: IndexManager) {
    this.queueName = queueName;
    this.indexManager = indexManager;
  }

  start(): void {
    if (this.worker) {
      console.log(`[ELASTICSEARCH MODULE] ⚠️ Worker already running`);
      return;
    }

    const workerConnection = createRedisConnection("WORKER");

    this.worker = new Worker<ProductEmbeddingJobData>(
      this.queueName,
      async (job: Job<ProductEmbeddingJobData>) => {
        const { product_id, embedding } = job.data;

        console.log(
          `[ELASTICSEARCH MODULE WORKER] 🔍 Processing job ${job.id} for product ${product_id}`
        );
        console.log(
          `[ELASTICSEARCH MODULE WORKER] 🔍 Embedding vector: ${
            embedding.vectors
              ? `Array of ${embedding.vectors.length} values`
              : "MISSING!"
          }`
        );

        await this.indexManager.indexEmbedding(job.data);

        console.log(
          `[ELASTICSEARCH MODULE WORKER] ✅ Indexed embedding for product ${product_id} (job ${job.id})`
        );
      },
      {
        connection: workerConnection,
        concurrency: 5,
      }
    );

    this.worker.on("ready", () => {
      console.log(`[ELASTICSEARCH MODULE WORKER] ✅ Worker ready`);
    });

    this.worker.on("completed", (job) => {
      console.log(`[ELASTICSEARCH MODULE WORKER] ✅ Job ${job.id} completed`);
    });

    this.worker.on("failed", (job, err) => {
      console.error(
        `[ELASTICSEARCH MODULE WORKER] ❌ Job ${job?.id} failed: ${err.message}`
      );
    });

    console.log(`[ELASTICSEARCH MODULE] ✅ Worker started`);
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      console.log(`[ELASTICSEARCH MODULE] ✅ Worker stopped`);
    }
  }
}
