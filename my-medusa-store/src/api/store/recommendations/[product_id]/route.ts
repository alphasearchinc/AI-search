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
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(parsed, MAX_LIMIT));
    }
  }
  return DEFAULT_LIMIT;
};

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any;
  const { product_id } = req.params;
  const query = req.query as StoreRecommendationsQuery;

  if (!product_id || typeof product_id !== "string") {
    return res.status(400).json({ message: "Invalid product_id" });
  }

  const limit = sanitizeLimit(query.limit);
  const requestStartTime = Date.now();

  try {
    const { result } = await getProductRecommendationsWorkflow(req.scope).run({
      input: {
        product_id,
        limit,
      },
    });

    const totalDuration = Date.now() - requestStartTime;

    logger.info(
      `[Store Recommendations] product_id="${product_id}" ` +
        `took=${totalDuration}ms hits=${result.count}`
    );

    return res.json({
      product_id: result.product_id,
      limit,
      took: totalDuration,
      elastic_took: result.searchDuration,
      count: result.count,
      recommendations: result.hits,
    });
  } catch (error: any) {
    logger.error(
      `[Store Recommendations] Failed for product_id="${product_id}"`,
      error
    );

    const is404 = error?.message?.includes("not found");
    const statusCode = is404 ? 404 : 500;

    return res.status(statusCode).json({
      message: is404
        ? "Product embedding not found"
        : "Failed to fetch recommendations",
      detail: error?.message || "Unknown error",
    });
  }
};