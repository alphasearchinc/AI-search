import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { productEmbeddingQueue } from "../../../lib/elasticsearch-queue";

type StoreEmbeddingInput = {
  product_id: string;
  embedding: object;
  embedded_text: string;
  metadata?: Record<string, any>;
};

export const storeEmbeddingStep = createStep(
  "store-embedding-step",
  async (input: StoreEmbeddingInput) => {
    const job = await productEmbeddingQueue.add("embedding.index", {
      product_id: input.product_id,
      embedding: input.embedding,
      embedded_text: input.embedded_text,
      metadata: input.metadata,
    });

    return new StepResponse(
      {
        job_id: job.id,
        product_id: input.product_id,
      },
      {
        job_id: job.id,
      }
    );
  }
);
