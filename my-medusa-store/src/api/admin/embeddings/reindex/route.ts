import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { ELASTICSEARCH_MODULE } from "../../../../modules/elasticsearch";
import ElasticsearchModuleService from "../../../../modules/elasticsearch/services/main";
import { embedProductWorkflow } from "../../../../workflows/product-embedding/embed-product";

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve("logger");

  try {
    logger.info("[Reindex] Starting full reindex process...");

    const elasticsearchService: ElasticsearchModuleService =
      req.scope.resolve(ELASTICSEARCH_MODULE);

    // Step 1: Delete existing index
    logger.info("[Reindex] Deleting existing index...");
    await elasticsearchService.deleteIndex();
    logger.info("[Reindex] Index deleted successfully");

    // Step 2: Recreate index with correct dimensions
    logger.info("[Reindex] Recreating index with current embedding dimensions...");
    await elasticsearchService.initializeIndex();
    logger.info("[Reindex] Index recreated successfully");

    // Step 3: Get all products and queue embeddings
    logger.info("[Reindex] Fetching all products...");
    const productModuleService = req.scope.resolve(Modules.PRODUCT);
    const [products] = await productModuleService.listAndCountProducts({}, {});

    logger.info(`[Reindex] Found ${products.length} products`);

    if (products.length === 0) {
      return res.json({
        message: "No products to embed",
        results: {
          total: 0,
          enqueued: 0,
          failed: 0,
        },
      });
    }

    logger.info(`[Reindex] Queueing ${products.length} products for embedding...`);

    let successCount = 0;
    let failCount = 0;
    const errors: Array<{ product_id: string; error: string }> = [];

    // Use the workflow to queue jobs
    for (const product of products) {
      try {
        await embedProductWorkflow(req.scope).run({
          input: { product_id: product.id },
        });

        successCount++;
        
        if (successCount % 50 === 0 || successCount === products.length) {
          logger.info(`[Reindex] Queued ${successCount}/${products.length} products`);
        }
      } catch (error: any) {
        failCount++;
        errors.push({
          product_id: product.id,
          error: error.message || "Unknown error",
        });
        logger.error(
          `[Reindex] Failed to queue product ${product.id}: ${error.message}`
        );
      }
    }

    logger.info(
      `[Reindex] Complete: ${successCount} enqueued, ${failCount} failed. Worker will process embeddings.`
    );

    return res.json({
      message: "Reindex jobs queued successfully. Worker will process embeddings asynchronously.",
      results: {
        total: products.length,
        enqueued: successCount,
        failed: failCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error: any) {
    logger.error("[Reindex] Failed to complete reindex:", error);

    return res.status(500).json({
      message: "Failed to complete reindex",
      error: error.message,
    });
  }
};
