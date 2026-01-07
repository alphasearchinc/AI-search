import { Queue } from "bullmq";
import { createRedisConnection } from "../../../lib/redis-connection";
import { ProductEmbeddingJobData } from "../types";

export class ElasticsearchQueue {
  private queue: Queue<ProductEmbeddingJobData>;
  public readonly queueName: string;

  constructor(queueName: string) {
    this.queueName = queueName;
    const queueConnection = createRedisConnection("QUEUE");
    this.queue = new Queue<ProductEmbeddingJobData>(this.queueName, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: 100,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });
    console.log(
      `[ELASTICSEARCH MODULE] [INFO] Queue "${this.queueName}" initialized`
    );
  }

  async add(data: ProductEmbeddingJobData): Promise<void> {
    await this.queue.add("embed", data);
    console.log(
      `[ELASTICSEARCH MODULE] [INFO] Queued embedding for product ${data.product_id}`
    );
  }

  getQueue(): Queue<ProductEmbeddingJobData> {
    return this.queue;
  }
}
