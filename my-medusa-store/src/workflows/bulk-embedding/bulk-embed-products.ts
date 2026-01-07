import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { enqueueAllProductsStep } from "./steps/enqueue-all-products";

type BulkEmbedProductsInput = {
  batch_size?: number;
};

type BulkEmbedProductsOutput = {
  total: number;
  enqueued: number;
  failed: number;
  errors: Array<{ product_id: string; error: string }>;
};

/**
 * Fetches all products and enqueues embedding jobs with pagination support.
 */
export const bulkEmbedProductsWorkflow = createWorkflow(
  "bulk-embed-products",
  (input: BulkEmbedProductsInput) => {
    // Enqueue all products with pagination
    const result = enqueueAllProductsStep({
      batch_size: input.batch_size || 100,
    });

    return new WorkflowResponse(result);
  }
);
