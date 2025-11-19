import {
  createWorkflow,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk";
import { generateQueryEmbeddingStep } from "./steps/generate-query-embedding";
import { executeElasticsearchQueryStep } from "./steps/execute-elasticsearch-query";
import { enrichWithProductsStep } from "./steps/enrich-with-products";

type AdminSearchInput = {
  query: string;
  limit: number;
  filters?: { product_ids?: string[] };
  includeProduct?: boolean;
  includeEmbedding?: boolean;
  minConfidence?: number;
};

type AdminSearchOutput = {
  query: string;
  limit: number;
  took: number;
  count: number;
  mode: "hybrid" | "bm25" | "vector" | "bm25-only";
  embedding?: { vectors: number[]; dimensions: number };
  hits: any[];
};

/**
 * Admin semantic search workflow.
 *
 * This workflow:
 * 1. Generates embedding for the search query (with BM25 fallback)
 * 2. Executes Elasticsearch query with optional filters
 * 3. Optionally enriches results with full product data
 * 4. Returns all products (not limited to published)
 *
 * Admin users can see all products and get full product objects.
 */
export const adminSearchWorkflow = createWorkflow(
  "admin-search",
  (input: AdminSearchInput) => {
    const workflowStartTime = Date.now();

    // Step 1: Generate embedding
    const embeddingResult = generateQueryEmbeddingStep({
      query: input.query,
    });

    // Step 2: Execute Elasticsearch query
    const searchResult = executeElasticsearchQueryStep({
      query: input.query,
      embedding: embeddingResult.embedding,
      mode: embeddingResult.mode,
      limit: input.limit,
      filters: input.filters,
      minConfidence: input.minConfidence,
      includeEmbedding: input.includeEmbedding,
    });

    // Step 3: Conditionally enrich with products (if requested)
    const hits = transform(
      { searchResult, includeProduct: input.includeProduct },
      async ({ searchResult, includeProduct }, { container }) => {
        if (!includeProduct) {
          return searchResult.hits;
        }

        // Manually call enrichment for admin (all products, not just published)
        const { Modules } = await import("@medusajs/framework/utils");
        const productModuleService = container.resolve(Modules.PRODUCT);

        if (!searchResult.hits.length) {
          return [];
        }

        const productIds = Array.from(
          new Set(
            searchResult.hits
              .map((hit: any) => hit.product_id)
              .filter(
                (id: any): id is string =>
                  typeof id === "string" && id.trim().length > 0
              )
          )
        );

        if (!productIds.length) {
          return searchResult.hits;
        }

        const [products] = await productModuleService.listAndCountProducts(
          { id: productIds },
          { take: productIds.length }
        );

        const productMap = new Map(
          products.map((product: any) => [product.id, product])
        );

        return searchResult.hits.map((hit: any) => ({
          ...hit,
          product: hit.product_id
            ? productMap.get(hit.product_id) || null
            : null,
        }));
      }
    );

    const totalDuration = transform(
      { workflowStartTime },
      () => Date.now() - workflowStartTime
    );

    // Return final result
    return new WorkflowResponse(
      transform(
        {
          query: input.query,
          limit: input.limit,
          searchResult,
          embeddingResult,
          includeEmbedding: input.includeEmbedding,
          hits,
          totalDuration,
        },
        (data) => ({
          query: data.query,
          limit: data.limit,
          took: data.totalDuration,
          count: data.searchResult.count,
          mode: data.searchResult.mode,
          embedding: data.includeEmbedding
            ? data.embeddingResult.embedding
            : undefined,
          hits: data.hits,
        })
      )
    );
  }
);
