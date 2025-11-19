import {
  createWorkflow,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk";
import { generateQueryEmbeddingStep } from "./steps/generate-query-embedding";
import { executeElasticsearchQueryStep } from "./steps/execute-elasticsearch-query";
import { enrichWithProductsStep } from "./steps/enrich-with-products";
import { recordSearchMetricsStep } from "./steps/record-search-metrics";

type StoreSearchInput = {
  query: string;
  limit: number;
  minConfidence?: number;
};

type StoreSearchOutput = {
  query: string;
  limit: number;
  took: number;
  total: number;
  count: number;
  mode: "hybrid" | "bm25" | "vector" | "bm25-only";
  hits: Array<{
    id: string;
    score: number;
    bm25_score?: number;
    vector_score?: number;
    product: {
      id: string;
      title?: string | null;
      subtitle?: string | null;
      description?: string | null;
      handle?: string | null;
      thumbnail?: string | null;
    };
    metadata?: Record<string, any>;
  }>;
};

/**
 * Store-facing semantic search workflow.
 *
 * This workflow:
 * 1. Generates embedding for the search query (with BM25 fallback)
 * 2. Executes Elasticsearch query
 * 3. Enriches results with published product data only
 * 4. Records search metrics asynchronously
 *
 * Only published products are returned to store users.
 */
export const storeSearchWorkflow = createWorkflow(
  "store-search",
  (input: StoreSearchInput) => {
    const workflowStartTime = Date.now();

    // Step 1: Generate embedding (with timing and fallback)
    const embeddingStartTime = Date.now();
    const embeddingResult = generateQueryEmbeddingStep({
      query: input.query,
    });
    const embeddingDuration = transform(
      { embeddingStartTime },
      () => Date.now() - embeddingStartTime
    );

    // Step 2: Execute Elasticsearch query
    const searchStartTime = Date.now();
    const searchResult = executeElasticsearchQueryStep({
      query: input.query,
      embedding: embeddingResult.embedding,
      mode: embeddingResult.mode,
      limit: input.limit,
      minConfidence: input.minConfidence,
      includeEmbedding: false,
    });
    const searchDuration = transform(
      { searchStartTime },
      () => Date.now() - searchStartTime
    );

    // Step 3: Enrich with published products only
    const enrichedHits = enrichWithProductsStep({
      hits: searchResult.hits,
      published_only: true,
    });

    // Calculate total duration
    const totalDuration = transform(
      { workflowStartTime },
      () => Date.now() - workflowStartTime
    );

    // Step 4: Record metrics asynchronously
    recordSearchMetricsStep(
      transform(
        {
          query: input.query,
          embeddingResult,
          embeddingDuration,
          searchDuration,
          totalDuration,
          enrichedHits,
        },
        (data) => ({
          query: data.query,
          embedding_dimensions: data.embeddingResult.embedding.dimensions,
          embedding_generation_ms: data.embeddingDuration,
          elasticsearch_query_ms: data.searchDuration,
          total_duration_ms: data.totalDuration,
          results_count: data.enrichedHits.length,
          user_type: "store" as const,
        })
      )
    );

    // Return final result
    return new WorkflowResponse(
      transform(
        {
          query: input.query,
          limit: input.limit,
          searchResult,
          enrichedHits,
          totalDuration,
        },
        (data) => ({
          query: data.query,
          limit: data.limit,
          took: data.totalDuration,
          total: data.searchResult.count,
          count: data.enrichedHits.length,
          mode: data.searchResult.mode,
          hits: data.enrichedHits,
        })
      )
    );
  }
);
