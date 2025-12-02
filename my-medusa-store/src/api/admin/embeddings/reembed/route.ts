import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { bulkEmbedProductsWorkflow } from "../../../../workflows/bulk-embedding/bulk-embed-products";

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve("logger");

  try {
    const { result } = await bulkEmbedProductsWorkflow(req.scope).run({
      input: {
        batch_size: 100,
      },
    });

    return res.json({
      message: "Bulk re-embedding jobs enqueued successfully",
      results: result,
    });
  } catch (error: any) {
    logger.error("[Bulk Re-embed] Failed to enqueue products:", error);

    return res.status(500).json({
      message: "Failed to enqueue bulk re-embedding jobs",
      error: error.message,
    });
  }
};
