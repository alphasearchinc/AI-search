import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { getProductDataStep } from "./steps/get-product-data";
import { generateEmbeddingStep } from "./steps/generate-embedding";
import { storeEmbeddingStep } from "./steps/store-embedding";

type EmbedProductInput = {
  product_id: string;
};

export const embedProductWorkflow = createWorkflow(
  "embed-product-workflow",
  (input: EmbedProductInput) => {
    // Step 1: Get product data
    const productData = getProductDataStep({
      product_id: input.product_id,
    });

    // Step 2: Generate embedding from the product text
    const embeddingResult = generateEmbeddingStep({
      text: productData.embedded_text,
    });

    // Step 3: Queue the embedding for storage
    const queuedEmbeddingJob = storeEmbeddingStep({
      product_id: productData.product_id,
      embedding: embeddingResult.embedding,  // Access the embedding property
      embedded_text: productData.embedded_text,
      metadata: productData.metadata,
    });

    return new WorkflowResponse(queuedEmbeddingJob);
  }
);
