import {
  createWorkflow,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk";
import { getAllProductsStep } from "./steps/get-all-products";
import { enqueueProductsStep } from "./steps/enqueue-products";

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
 * 1. Fetches all products from the database
 * 2. Enqueues embedding jobs for each product via embedProductWorkflow
 * 3. Tracks success/failure counts
 * 
 * Note: This is a simplified implementation that processes all products in a single batch.
 * For very large product catalogs (10k+ products), consider implementing pagination
 * or breaking this into multiple workflow executions.
 */
export const bulkEmbedProductsWorkflow = createWorkflow(
  "bulk-embed-products",
  (input: BulkEmbedProductsInput) => {
    // Step 1: Get all products
    const productBatch = getAllProductsStep({
      batch_size: input.batch_size || 100,
    });

    // Step 2: Extract product IDs for enqueueing
    const productIds = transform({ productBatch }, ({ productBatch }) =>
      productBatch.products.map((p) => p.id)
    );

    // Step 3: Enqueue embedding jobs for all products
    const enqueueResult = enqueueProductsStep({ product_ids: productIds });

    // Step 4: Combine results
    const finalResult = transform(
      { productBatch, enqueueResult },
      ({ productBatch, enqueueResult }) => ({
        total: productBatch.total_count,
        enqueued: enqueueResult.enqueued,
        failed: enqueueResult.failed,
        errors: enqueueResult.errors,
      })
    );

    return new WorkflowResponse(finalResult);
  }
);
