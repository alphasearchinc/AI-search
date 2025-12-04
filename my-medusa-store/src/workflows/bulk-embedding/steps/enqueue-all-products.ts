import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import { embedProductWorkflow } from "../../product-embedding/embed-product";

type EnqueueAllProductsInput = {
  batch_size?: number;
};

type EnqueueResult = {
  total: number;
  enqueued: number;
  failed: number;
  errors: Array<{ product_id: string; error: string }>;
};

export const enqueueAllProductsStep = createStep(
  "enqueue-all-products",
  async (input: EnqueueAllProductsInput, { container }) => {
    const logger = container.resolve("logger");
    const productModuleService = container.resolve(Modules.PRODUCT);
    const batchSize = input.batch_size || 100;

    let offset = 0;
    let total = 0;

    const result: EnqueueResult = {
      total: 0,
      enqueued: 0,
      failed: 0,
      errors: [],
    };

    logger.info("[Bulk Embedding] Starting bulk embedding job enqueue...");

    while (true) {
      const [products, count] = await productModuleService.listAndCountProducts(
        {},
        {
          skip: offset,
          take: batchSize,
        }
      );

      // Set total count on first iteration
      if (total === 0) {
        total = count;
        result.total = count;
        logger.info(`[Bulk Embedding] Found ${count} products to embed`);
      }

      // No more products to process
      if (!products.length) {
        break;
      }

      // Enqueue embedding jobs for this batch
      for (const product of products) {
        try {
          await embedProductWorkflow(container).run({
            input: {
              product_id: product.id,
            },
          });

          result.enqueued++;
          logger.info(
            `[Bulk Embedding] Queued embedding for product: ${product.id} (${result.enqueued}/${total})`
          );
        } catch (error: any) {
          result.failed++;
          result.errors.push({
            product_id: product.id,
            error: error.message || "Unknown error",
          });
          logger.error(
            `[Bulk Embedding] Failed to queue job for product ${product.id}:`,
            error
          );
        }
      }

      offset += products.length;

      // Stop if we've processed all products
      if (offset >= count) {
        break;
      }
    }

    logger.info(
      `[Bulk Embedding] Complete: ${result.enqueued} enqueued, ${result.failed} failed`
    );

    return new StepResponse(result);
  }
);
