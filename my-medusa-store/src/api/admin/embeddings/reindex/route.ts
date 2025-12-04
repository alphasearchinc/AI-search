import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ELASTICSEARCH_MODULE } from "../../../../modules/elasticsearch";
import ElasticsearchModuleService from "../../../../modules/elasticsearch/services/main";
import { bulkEmbedProductsWorkflow } from "../../../../workflows/bulk-embedding/bulk-embed-products";

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

    // Step 3: Queue all products for embedding using bulk workflow
    logger.info("[Reindex] Queueing products for embedding...");
    
    const { result } = await bulkEmbedProductsWorkflow(req.scope).run({
      input: { batch_size: 100 },
    });

    logger.info(
      `[Reindex] Complete: ${result.enqueued} enqueued, ${result.failed} failed. Worker will process embeddings.`
    );

    return res.json({
      message: "Reindex jobs queued successfully. Worker will process embeddings asynchronously.",
      results: {
        total: result.total,
        enqueued: result.enqueued,
        failed: result.failed,
        errors: result.errors.length > 0 ? result.errors : undefined,
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
