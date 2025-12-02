import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getProductRecommendationsWorkflow } from "../../../../workflows/recommendations/get-product-recommendations";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

type StoreRecommendationsQuery = {
  limit?: string;
};

const sanitizeLimit = (rawLimit: unknown): number => {
  if (typeof rawLimit === "string") {
    const parsed = parseInt(rawLimit, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(parsed, MAX_LIMIT);
    }
  }
  return DEFAULT_LIMIT;
};

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any;
  const { product_id } = req.params;
  const query = req.query as StoreRecommendationsQuery;

  if (!product_id || typeof product_id !== "string") {
    return res.status(400).json({
      message: "Invalid product_id",
      error: "product_id parameter is required",
    });
  }

  const limit = sanitizeLimit(query.limit);
  const startTime = Date.now();

  try {
    const { result } = await getProductRecommendationsWorkflow(req.scope).run({
      input: { product_id, limit },
    }) as any;

    const duration = Date.now() - startTime;

    logger.info(
      `[Store Recommendations] product_id="${product_id}" ` +
        `returned ${result.count} hits in ${duration}ms`
    );

    return res.json({
      product_id: result.product_id,
      limit,
      took: duration,
      elastic_took: result.searchDuration,
      count: result.count,
      recommendations: result.hits,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error(
      `[Store Recommendations] Failed for product_id="${product_id}" ` +
        `after ${duration}ms: ${error.message}`
    );

    // Product not found in index
    if (error.meta?.statusCode === 404) {
      return res.status(404).json({
        message: "Product not found",
        error: "The specified product does not exist or has not been indexed yet",
      });
    }

    return res.status(500).json({
      message: "Failed to fetch recommendations",
      error: error.message,
    });
  }
};