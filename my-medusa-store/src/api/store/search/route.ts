import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { metricsRepository } from "../../../lib/metrics-repository";
import { searchProductsWorkflow } from "../../../workflows/search/search-products";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const MAX_QUERY_LENGTH = 2000;

type StoreSemanticSearchBody = {
  query?: string;
  limit?: number;
  min_confidence?: number;
  category_ids?: string[];
  min_price?: number;
  max_price?: number;
  include_facets?: boolean;
};

const sanitizeLimit = (rawLimit: unknown): number => {
  if (typeof rawLimit === "number" && Number.isFinite(rawLimit)) {
    const limit = Math.trunc(rawLimit);
    return Math.max(1, Math.min(limit, MAX_LIMIT));
  }

  return DEFAULT_LIMIT;
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any;
  const body = (req.body || {}) as StoreSemanticSearchBody;
  const rawQuery = typeof body.query === "string" ? body.query : "";
  const query = rawQuery.trim();

  const requestStartTime = Date.now();

  if (!query) {
    return res
      .status(400)
      .json({ message: "Body must include a non-empty 'query' string" });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({
      message: `Query exceeds maximum allowed length of ${MAX_QUERY_LENGTH} characters`,
    });
  }

  const limit = sanitizeLimit(body.limit);
  let minConfidence: number | undefined = undefined;
  if (body.min_confidence !== undefined) {
    if (
      typeof body.min_confidence !== "number" ||
      !Number.isFinite(body.min_confidence)
    ) {
      return res.status(400).json({
        message: "min_confidence must be a number between 0 and 1",
      });
    }

    minConfidence = Math.min(Math.max(body.min_confidence, 0), 1);
  }

  // Parse category_ids filter
  const categoryIds = Array.isArray(body.category_ids)
    ? body.category_ids.filter((id) => typeof id === "string" && id.trim())
    : [];

  // Parse price filters
  const minPrice =
    typeof body.min_price === "number" && Number.isFinite(body.min_price)
      ? body.min_price
      : undefined;
  const maxPrice =
    typeof body.max_price === "number" && Number.isFinite(body.max_price)
      ? body.max_price
      : undefined;

  // Whether to include facets in response (default: true)
  const includeFacets = body.include_facets !== false;

  // Build filters object
  const hasFilters =
    categoryIds.length > 0 || minPrice !== undefined || maxPrice !== undefined;
  const filters = hasFilters
    ? {
        ...(categoryIds.length > 0 && { category_ids: categoryIds }),
        ...(minPrice !== undefined && { min_price: minPrice }),
        ...(maxPrice !== undefined && { max_price: maxPrice }),
      }
    : undefined;

  try {
    const { result } = await searchProductsWorkflow(req.scope).run({
      input: {
        query,
        limit,
        min_confidence: minConfidence,
        filters,
        include_facets: includeFacets,
      },
    });

    const totalDuration = Date.now() - requestStartTime;

    // Record metrics (non-blocking)
    const filtersApplied =
      categoryIds.length > 0
        ? categoryIds.map((id) => `category_id:${id}`)
        : undefined;

    metricsRepository
      .recordSearch({
        query,
        query_length: query.length,
        embedding_dimensions: result.embeddingDimensions,
        embedding_generation_ms: result.embeddingDuration,
        elasticsearch_query_ms: result.searchDuration,
        total_duration_ms: totalDuration,
        results_count: result.hits.length,
        filters_applied: filtersApplied,
        user_type: "store",
      })
      .catch((err) => logger.error("[METRICS] Failed to record:", err));

    logger.info(
      `[Store Semantic Search] query="${query.slice(0, 50)}..." ` +
        `took=${totalDuration}ms (embed=${result.embeddingDuration}ms, search=${result.searchDuration}ms) ` +
        `hits=${result.hits.length} mode=${result.mode}` +
        (categoryIds.length > 0
          ? ` filters=[${categoryIds.length} categories]`
          : "")
    );

    return res.json({
      query,
      limit,
      took: totalDuration,
      total: result.count,
      count: result.hits.length,
      mode: result.mode,
      hits: result.hits,
      facets: result.facets,
    });
  } catch (error: any) {
    logger.error("[Store Semantic Search] Failed to execute search", error);
    const message = error?.message || "Semantic search failed";

    return res.status(500).json({
      message: "Failed to execute semantic search",
      detail: message,
    });
  }
};
