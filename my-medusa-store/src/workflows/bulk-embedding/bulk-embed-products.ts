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
 * Workflow for bulk embedding all products in the database.
 *
 * This workflow:
 * 1. Fetches all products with pagination
 * 2. Enqueues embedding jobs for each product via embedProductWorkflow
 * 3. Tracks success/failure counts and errors
 *
 * The workflow handles pagination internally and processes products in batches
 * to avoid memory issues with large product catalogs.
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
