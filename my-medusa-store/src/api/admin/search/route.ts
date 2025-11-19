import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { adminSearchWorkflow } from "../../../workflows/search/admin-search";
import type { SemanticSearchHit } from "../../../modules/elasticsearch/types";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 2000;
const MAX_FILTER_PRODUCT_IDS = 100;

type SemanticSearchFilters = {
  product_ids?: string[];
};

type SemanticSearchBody = {
  query: string;
  limit?: number;
  filters?: SemanticSearchFilters;
  include_product?: boolean;
  include_embedding?: boolean;
  min_confidence?: number;
};

type SemanticSearchHitResponse = SemanticSearchHit & {
  product?: Record<string, any> | null;
};

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve("logger") as any;
  const body = (req.body || {}) as SemanticSearchBody;
  const rawQuery = typeof body.query === "string" ? body.query : "";
  const query = rawQuery.trim();

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

  let limit = DEFAULT_LIMIT;
  if (typeof body.limit === "number" && Number.isFinite(body.limit)) {
    limit = Math.max(1, Math.min(Math.trunc(body.limit), MAX_LIMIT));
  }

  const includeProduct = Boolean(body.include_product);
  const includeEmbedding = Boolean(body.include_embedding);

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

  const filters = body.filters || {};
  let productIds: string[] = [];
  if (filters.product_ids !== undefined) {
    if (!Array.isArray(filters.product_ids)) {
      return res.status(400).json({
        message: "filters.product_ids must be an array of product IDs",
      });
    }

    productIds = filters.product_ids
      .filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      )
      .map((id) => id.trim());
    productIds = Array.from(new Set(productIds));

    if (productIds.length !== filters.product_ids.length) {
      return res.status(400).json({
        message: "filters.product_ids must contain only non-empty strings",
      });
    }

    if (productIds.length > MAX_FILTER_PRODUCT_IDS) {
      return res.status(400).json({
        message: `filters.product_ids cannot exceed ${MAX_FILTER_PRODUCT_IDS} values`,
      });
    }
  }

  try {
    // Execute search using workflow
    const { result } = await adminSearchWorkflow(req.scope).run({
      input: {
        query,
        limit,
        filters: productIds.length ? { product_ids: productIds } : undefined,
        includeProduct,
        includeEmbedding,
        minConfidence,
      },
    });

    res.json(result);
  } catch (error: any) {
    logger.error("[Semantic Search] Failed to execute search", error);
    const message = error?.message || "Semantic search failed";

    if (message.toLowerCase().includes("embedding service")) {
      return res.status(503).json({
        message: "Embedding service unavailable",
        detail: message,
      });
    }

    return res.status(500).json({
      message: "Failed to execute semantic search",
      detail: message,
    });
  }
};
