import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { getProductDataStep } from "./steps/get-product-data";
import { storeEmbeddingStep } from "./steps/store-embedding";

type EmbedProductInput = {
  product_id: string;
};

/**
 * Queues a product for embedding generation and Elasticsearch indexing.
 * Worker processes the job asynchronously.
 */
export const embedProductWorkflow = createWorkflow(
  "embed-product-workflow",
  (input: EmbedProductInput) => {
    // Get product data
    const productData = getProductDataStep({
      product_id: input.product_id,
    });

    // Queue the job; worker will generate embedding and index to Elasticsearch
    const queuedJob = storeEmbeddingStep({
      product_id: productData.product_id,
      text_to_embed: productData.embedded_text,
      metadata: productData.metadata,
    });

    return new WorkflowResponse(queuedJob);
  }
);
