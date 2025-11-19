import type { MedusaContainer } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { embedProductWorkflow } from "../workflows/product-embedding/embed-product";

export type BulkEnqueueResult = {
  total: number;
  enqueued: number;
  failed: number;
  errors: Array<{ product_id: string; error: string }>;
};

/**
 * Service for bulk embedding operations.
 * Handles pagination, workflow orchestration, and progress tracking.
 */
export class BulkEmbeddingService {
  private logger: any;
  private productModuleService: any;

  constructor(private container: MedusaContainer) {
    this.logger = container.resolve("logger");
    this.productModuleService = container.resolve(Modules.PRODUCT);
  }

  /**
   * Enqueue embedding jobs for all products in the database.
   * Automatically handles pagination and error tracking.
   */
  async enqueueAllProducts(): Promise<BulkEnqueueResult> {
    const BATCH_SIZE = 100;
    let offset = 0;
    let total = 0;

    const results: BulkEnqueueResult = {
      total: 0,
      enqueued: 0,
      failed: 0,
      errors: [],
    };

    this.logger.info("[Bulk Embedding] Starting bulk embedding job enqueue...");

    while (true) {
      const [products, count] =
        await this.productModuleService.listAndCountProducts(
          {},
          {
            skip: offset,
            take: BATCH_SIZE,
          }
        );

      // Set total count on first iteration
      if (total === 0) {
        total = count;
        results.total = count;
        this.logger.info(`[Bulk Embedding] Found ${count} products to embed`);
      }

      // No more products to process
      if (!products.length) {
        break;
      }

      // Enqueue embedding jobs for this batch
      await this.enqueueBatch(products, results);

      offset += products.length;

      // Stop if we've processed all products
      if (offset >= count) {
        break;
      }
    }

    this.logger.info(
      `[Bulk Embedding] Complete: ${results.enqueued} enqueued, ${results.failed} failed`
    );

    return results;
  }

  /**
   * Enqueue embedding jobs for a batch of products.
   */
  private async enqueueBatch(
    products: any[],
    results: BulkEnqueueResult
  ): Promise<void> {
    for (const product of products) {
      try {
        const { result } = await embedProductWorkflow(this.container).run({
          input: {
            product_id: product.id,
          },
        });

        results.enqueued++;
        this.logger.info(
          `[Bulk Embedding] Queued job ${result.job_id} for product: ${product.id}`
        );
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          product_id: product.id,
          error: error.message || "Unknown error",
        });
        this.logger.error(
          `[Bulk Embedding] Failed to queue job for product ${product.id}:`,
          error
        );
      }
    }
  }
}
