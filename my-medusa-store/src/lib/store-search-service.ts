import type { MedusaContainer } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { embedText } from "./embedding-client";
import { metricsRepository } from "./metrics-repository";
import { ELASTICSEARCH_MODULE } from "../modules/elasticsearch";
import type ElasticsearchModuleService from "../modules/elasticsearch/service";
import type { SearchMode } from "../modules/elasticsearch/types";

export type StoreSearchParams = {
  query: string;
  limit: number;
  minConfidence?: number;
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

export type StoreSearchResult = {
  query: string;
  limit: number;
  took: number;
  total: number;
  count: number;
  mode: SearchMode | "bm25-only";
  hits: StoreSemanticSearchHit[];
};

type TimingMetrics = {
  embeddingDuration: number;
  searchDuration: number;
  totalDuration: number;
};

/**
 * Service for executing store-facing semantic search operations.
 * Handles timing, metrics, product filtering, and field selection.
 */
export class StoreSearchService {
  private logger: any;
  private elasticsearchService: ElasticsearchModuleService;
  private productModuleService: any;

  constructor(private container: MedusaContainer) {
    this.logger = container.resolve("logger");
    this.elasticsearchService = container.resolve(ELASTICSEARCH_MODULE);
    this.productModuleService = container.resolve(Modules.PRODUCT);
  }

  /**
   * Execute store search with published products only, timing, and metrics.
   */
  async executeStoreSearch(
    params: StoreSearchParams
  ): Promise<StoreSearchResult> {
    const { query, limit, minConfidence } = params;
    const requestStartTime = Date.now();

    // Generate embedding with timing
    const { embedding, mode, embeddingDuration } =
      await this.generateEmbeddingWithTiming(query);

    // Execute search with timing
    const searchStartTime = Date.now();
    const searchResult = await this.elasticsearchService.semanticSearch({
      query,
      embedding,
      limit,
      includeEmbedding: false,
      mode: mode === "bm25-only" ? "bm25" : "hybrid",
      minConfidence,
    });
    const searchDuration = Date.now() - searchStartTime;

    // Filter and enrich with published products only
    const hits = await this.getPublishedProductHits(searchResult.hits, limit);

    const totalDuration = Date.now() - requestStartTime;

    // Record metrics asynchronously (non-blocking)
    this.recordMetrics({
      query,
      embedding,
      embeddingDuration,
      searchDuration,
      totalDuration,
      resultsCount: hits.length,
    });

    this.logger.info(
      `[Store Search] query="${query.slice(0, 50)}..." ` +
        `took=${totalDuration}ms (embed=${embeddingDuration}ms, search=${searchDuration}ms) ` +
        `hits=${hits.length} mode=${searchResult.mode}`
    );

    return {
      query,
      limit,
      took: totalDuration,
      total: searchResult.count,
      count: hits.length,
      mode: searchResult.mode,
      hits,
    };
  }

  /**
   * Generate embedding with timing metrics and fallback handling.
   */
  private async generateEmbeddingWithTiming(query: string): Promise<{
    embedding: { vectors: number[]; dimensions: number };
    mode: SearchMode | "bm25-only";
    embeddingDuration: number;
  }> {
    const embeddingStartTime = Date.now();

    try {
      const embedding = await embedText(query);
      const embeddingDuration = Date.now() - embeddingStartTime;
      return { embedding, mode: "hybrid", embeddingDuration };
    } catch (error: any) {
      const embeddingDuration = Date.now() - embeddingStartTime;
      this.logger.warn(
        `[Store Search] Embedding unavailable, falling back to BM25-only: ${error.message}`
      );
      // Return dummy embedding for metrics
      return {
        embedding: { vectors: [], dimensions: 0 },
        mode: "bm25-only",
        embeddingDuration,
      };
    }
  }

  /**
   * Filter search results to published products only and enrich with product data.
   */
  private async getPublishedProductHits(
    searchHits: any[],
    limit: number
  ): Promise<StoreSemanticSearchHit[]> {
    const productIds = this.extractUniqueProductIds(searchHits);
    if (productIds.length === 0) {
      return [];
    }

    // Fetch only published products
    const [products] = await this.productModuleService.listAndCountProducts(
      {
        id: productIds,
        status: ["published"],
      },
      {
        take: productIds.length,
      }
    );

    const productMap = new Map(
      products.map((product: any) => [product.id, product])
    );

    // Build hits with products, filtering out unpublished ones
    const hits: StoreSemanticSearchHit[] = [];
    for (const hit of searchHits) {
      if (!hit.product_id) continue;

      const product = productMap.get(hit.product_id);
      if (!product) continue; // Skip if not published

      hits.push({
        id: hit.id,
        score: hit.score,
        bm25_score: hit.bm25_score,
        vector_score: hit.vector_score,
        product: this.selectProductFields(product),
        metadata: hit.metadata,
      });
    }

    return hits.slice(0, limit);
  }

  /**
   * Extract unique product IDs from search hits.
   */
  private extractUniqueProductIds(hits: any[]): string[] {
    return Array.from(
      new Set(
        hits
          .map((hit) => hit.product_id)
          .filter(
            (id): id is string => typeof id === "string" && id.trim().length > 0
          )
      )
    );
  }

  /**
   * Select only necessary product fields for store API response.
   */
  private selectProductFields(
    product: Record<string, any>
  ): StoreSemanticSearchProductSummary {
    return {
      id: product.id,
      title: product.title ?? null,
      subtitle: product.subtitle ?? null,
      description: product.description ?? null,
      handle: product.handle ?? null,
      thumbnail: product.thumbnail ?? null,
    };
  }

  /**
   * Record search metrics asynchronously (non-blocking).
   */
  private recordMetrics(params: {
    query: string;
    embedding: { vectors: number[]; dimensions: number };
    embeddingDuration: number;
    searchDuration: number;
    totalDuration: number;
    resultsCount: number;
  }): void {
    const {
      query,
      embedding,
      embeddingDuration,
      searchDuration,
      totalDuration,
      resultsCount,
    } = params;

    metricsRepository
      .recordSearch({
        query,
        query_length: query.length,
        embedding_dimensions: embedding.dimensions,
        embedding_generation_ms: embeddingDuration,
        elasticsearch_query_ms: searchDuration,
        total_duration_ms: totalDuration,
        results_count: resultsCount,
        filters_applied: undefined,
        user_type: "store",
      })
      .catch((err) =>
        this.logger.error("[Store Search] Failed to record metrics:", err)
      );
  }
}
