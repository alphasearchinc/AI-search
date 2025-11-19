import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { BulkEmbeddingService } from "../../../../lib/bulk-embedding-service";

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const bulkEmbeddingService = new BulkEmbeddingService(req.scope);
    const results = await bulkEmbeddingService.enqueueAllProducts();

    return res.json({
      message: "Bulk embedding jobs enqueued",
      results,
    });
  } catch (error: any) {
    const logger = req.scope.resolve("logger");
    logger.error("[Bulk Embedding] Failed to enqueue products:", error);

    return res.status(500).json({
      message: "Failed to enqueue bulk embedding jobs",
      error: error.message,
    });
  }
};
