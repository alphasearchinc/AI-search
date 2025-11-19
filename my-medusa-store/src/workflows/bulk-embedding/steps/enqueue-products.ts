import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { embedProductWorkflow } from "../../product-embedding/embed-product";

type EnqueueProductsInput = {
  product_ids: string[];
};

type EnqueueResult = {
  enqueued: number;
  failed: number;
  errors: Array<{ product_id: string; error: string }>;
};

export const enqueueProductsStep = createStep(
  "enqueue-products",
  async (input: EnqueueProductsInput, { container }) => {
    const logger = container.resolve("logger");
    const productIds = input.product_ids;

    const result: EnqueueResult = {
      enqueued: 0,
      failed: 0,
      errors: [],
    };

    logger.info(`[Bulk Embedding] Enqueueing ${productIds.length} products`);

    for (const productId of productIds) {
      try {
        const { result: workflowResult } = await embedProductWorkflow(
          container
        ).run({
          input: { product_id: productId },
        });

        result.enqueued++;
        logger.debug(
          `[Bulk Embedding] Queued job ${workflowResult.job_id} for product: ${productId}`
        );
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          product_id: productId,
          error: error.message || "Unknown error",
        });
        logger.error(
          `[Bulk Embedding] Failed to queue job for product ${productId}:`,
          error.message
        );
      }
    }

    logger.info(
      `[Bulk Embedding] Batch complete: ${result.enqueued} enqueued, ${result.failed} failed`
    );

    return new StepResponse(result);
  }
);
