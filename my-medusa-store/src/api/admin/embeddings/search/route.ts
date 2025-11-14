import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { embedText } from "../../../../lib/embedding-client";
import {
  semanticSearch,
  type SemanticSearchHit,
} from "../../../../lib/semantic-search";

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

  const filters = body.filters || {};
  let productIds: string[] = [];
  if (filters.product_ids !== undefined) {
    if (!Array.isArray(filters.product_ids)) {
      return res.status(400).json({
        message: "filters.product_ids must be an array of product IDs",
      });
    }

    productIds = filters.product_ids
      .filter((id): id is string => typeof id === "string" && id.trim().length)
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
    const { embedding, dimensions } = await embedText(query);

    const searchResult = await semanticSearch({
      embedding,
      limit,
      filters: productIds.length ? { product_ids: productIds } : undefined,
      includeEmbedding,
    });

    let hits: SemanticSearchHitResponse[] = searchResult.hits;

    if (includeProduct && hits.length) {
      const productModuleService = req.scope.resolve(Modules.PRODUCT);
      const uniqueProductIds = Array.from(
        new Set(
          hits
            .map((hit) => hit.product_id)
            .filter((id): id is string => typeof id === "string")
        )
      );

      if (uniqueProductIds.length) {
        const [products] = await productModuleService.listAndCountProducts(
          {
            id: uniqueProductIds,
          },
          {
            take: uniqueProductIds.length,
          }
        );

        const productMap = new Map(
          products.map((product) => [product.id, product])
        );

        hits = hits.map((hit) => ({
          ...hit,
          product: hit.product_id
            ? productMap.get(hit.product_id) || null
            : null,
        }));
      }
    }

    logger.info(
      `[Semantic Search] query="${query.slice(
        0,
        120
      )}" limit=${limit} hits=${hits.length} took=${searchResult.took}ms`
    );

    res.json({
      query,
      limit,
      took: searchResult.took,
      count: searchResult.count,
      embedding_dimensions: dimensions,
      hits,
    });
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
