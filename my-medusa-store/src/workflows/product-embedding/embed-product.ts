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
 * Queue a product for embedding.
 * 
 * This workflow:
 * 1. Fetches product data
 * 2. Queues the job to BullMQ
 * 3. Worker generates embedding and indexes to Elasticsearch
 * 
 * Used by:
 * - Product subscriber (automatic indexing on create/update)
 * - Bulk reindex endpoint
 * - Bulk re-embed endpoint
 */
export const embedProductWorkflow = createWorkflow(
  "embed-product-workflow",
  (input: EmbedProductInput) => {
    // Step 1: Get product data
    const productData = getProductDataStep({
      product_id: input.product_id,
    });

    // Step 2: Queue the job
    // Worker will generate embedding and index to Elasticsearch
    const queuedJob = storeEmbeddingStep({
      product_id: productData.product_id,
      text_to_embed: productData.embedded_text,
      metadata: productData.metadata,
    });

    return new WorkflowResponse(queuedJob);
  }
);
