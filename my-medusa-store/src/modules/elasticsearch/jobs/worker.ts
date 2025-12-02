import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../../../lib/redis-connection";
import { ProductEmbeddingJobData } from "../types";
import { IndexManager } from "../services/index-manager";
import { embedText } from "../../../lib/embedding-client";

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
        const { product_id, text_to_embed, metadata } = job.data;

        console.log(
          `[ELASTICSEARCH MODULE WORKER] 🔍 Processing job ${job.id} for product ${product_id}`
        );

        // Generate embedding
        console.log(
          `[ELASTICSEARCH MODULE WORKER] 🔗 Generating embedding for product ${product_id}...`
        );
        
        let embedding;
        try {
          embedding = await embedText(text_to_embed);
          console.log(
            `[ELASTICSEARCH MODULE WORKER] ✅ Generated ${embedding.dimensions}D embedding`
          );
        } catch (error: any) {
          console.error(
            `[ELASTICSEARCH MODULE WORKER] ❌ Failed to generate embedding for product ${product_id}: ${error.message}`
          );
          throw error;
        }

        // Index the embedding
        await this.indexManager.indexEmbedding({
          product_id,
          text_to_embed,
          metadata,
          embedding,
        });

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
