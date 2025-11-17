import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { embedText } from "../../../../lib/embedding-client";
import { semanticSearch } from "../../../../lib/semantic-search";

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

  try {
    const embedding = await embedText(query);
    const searchResult = await semanticSearch({
      embedding,
      limit,
      includeEmbedding: false,
    });

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
            product: selectProductFields(product),
            metadata: hit.metadata,
          };
        })
        .filter((hit): hit is StoreSemanticSearchHit => Boolean(hit))
        .slice(0, limit);
    }

    logger.info(
      `[Store Semantic Search] query="${query.slice(
        0,
        120
      )}" limit=${limit} hits=${hits.length} took=${searchResult.took}ms`
    );

    return res.json({
      query,
      limit,
      took: searchResult.took,
      total: searchResult.count,
      count: hits.length,
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
