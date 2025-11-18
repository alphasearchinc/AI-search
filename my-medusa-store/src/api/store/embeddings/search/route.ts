import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { embedText } from "../../../../lib/embedding-client";
import {
  semanticSearch,
  type SearchMode,
} from "../../../../lib/semantic-search";
import { metricsRepository } from "../../../../lib/metrics-repository";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const MAX_QUERY_LENGTH = 2000;

type StoreSemanticSearchBody = {
  query?: string;
  limit?: number;
};

type StoreSemanticSearchProductSummary = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  handle?: string | null;
  thumbnail?: string | null;
};

type StoreSemanticSearchHit = {
  id: string;
  score: number;
  bm25_score?: number;
  vector_score?: number;
  product: StoreSemanticSearchProductSummary;
  metadata?: Record<string, any>;
};

const sanitizeLimit = (rawLimit: unknown): number => {
  if (typeof rawLimit === "number" && Number.isFinite(rawLimit)) {
    const limit = Math.trunc(rawLimit);
    return Math.max(1, Math.min(limit, MAX_LIMIT));
  }

  return DEFAULT_LIMIT;
};

const selectProductFields = (product: Record<string, any>): StoreSemanticSearchProductSummary => ({
  id: product.id,
  title: product.title ?? null,
  subtitle: product.subtitle ?? null,
  description: product.description ?? null,
  handle: product.handle ?? null,
  thumbnail: product.thumbnail ?? null,
});

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

  let embedding: { vectors: number[]; dimensions: number };
  let requestedMode: SearchMode | "bm25-only" = "hybrid";
  let embeddingDuration = 0;

  try {
    const embeddingStartTime = Date.now();
    embedding = await embedText(query);
    embeddingDuration = Date.now() - embeddingStartTime;
  } catch (error: any) {
    requestedMode = "bm25-only";
    logger.warn(
      `[Store Semantic Search] Embedding unavailable, falling back to BM25-only: ${error.message}`
    );
    // For BM25-only, use dummy embedding for metrics
    embedding = { vectors: [], dimensions: 0 };
  }

  try {
    const searchStartTime = Date.now();
    const searchResult = await semanticSearch({
      query,
      embedding,
      limit,
      includeEmbedding: false,
      mode: requestedMode === "bm25-only" ? "bm25" : "hybrid",
    });
    const searchDuration = Date.now() - searchStartTime;

    let hits: StoreSemanticSearchHit[] = [];
    const productIds = Array.from(
      new Set(
        searchResult.hits
          .map((hit) => hit.product_id)
          .filter((id): id is string => typeof id === "string" && id.trim())
      )
    );

    if (productIds.length) {
      const productModuleService = req.scope.resolve(Modules.PRODUCT);
      const [products] = await productModuleService.listAndCountProducts(
        {
          id: productIds,
          status: ["published"],
        },
        {
          take: productIds.length,
        }
      );

      const productMap = new Map(products.map((product: any) => [product.id, product]));
      hits = searchResult.hits
        .map((hit) => {
          if (!hit.product_id) {
            return null;
          }

          const product = productMap.get(hit.product_id);
          if (!product) {
            return null;
          }

          return {
            id: hit.id,
            score: hit.score,
            bm25_score: hit.bm25_score,
            vector_score: hit.vector_score,
            product: selectProductFields(product),
            metadata: hit.metadata,
          };
        })
        .filter((hit): hit is StoreSemanticSearchHit => Boolean(hit))
        .slice(0, limit);
    }

    const totalDuration = Date.now() - requestStartTime;

    // Record metrics (non-blocking)
    metricsRepository.recordSearch({
      query,
      query_length: query.length,
      embedding_dimensions: embedding.dimensions,
      embedding_generation_ms: embeddingDuration,
      elasticsearch_query_ms: searchDuration,
      total_duration_ms: totalDuration,
      results_count: hits.length,
      filters_applied: undefined, // No filters in store search yet
      user_type: 'store',
    }).catch(err => console.error('[METRICS] Failed to record:', err));

    logger.info(
      `[Store Semantic Search] query="${query.slice(0, 50)}..." ` +
      `took=${totalDuration}ms (embed=${embeddingDuration}ms, search=${searchDuration}ms) ` +
      `hits=${hits.length} mode=${searchResult.mode}`
    );

    return res.json({
      query,
      limit,
      took: totalDuration,
      total: searchResult.count,
      count: hits.length,
      mode: searchResult.mode,
      hits,
    });
  } catch (error: any) {
    logger.error("[Store Semantic Search] Failed to execute search", error);
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
