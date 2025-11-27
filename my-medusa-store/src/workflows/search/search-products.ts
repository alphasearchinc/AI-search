import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { generateEmbeddingStep } from "./steps/generate-embedding";
import { searchIndexStep } from "./steps/search-index";
import { hydrateSearchHitsStep } from "./steps/hydrate-search-hits";

type SearchProductsWorkflowInput = {
  query: string;
  limit: number;
  offset?: number;
  min_confidence?: number;
  filters?: {
    category_ids?: string[];
    brands?: string[];
    min_price?: number;
    max_price?: number;
    options?: Record<string, string[]>;
  };
  include_facets?: boolean;
};

export const searchProductsWorkflow = createWorkflow(
  "search-products",
  function (input: SearchProductsWorkflowInput) {
    const {
      embedding,
      mode,
      duration: embeddingDuration,
    } = generateEmbeddingStep({ query: input.query });

    const searchResult = searchIndexStep({
      query: input.query,
      embedding,
      limit: input.limit,
      offset: input.offset,
      mode,
      minConfidence: input.min_confidence,
      filters: input.filters,
      includeFacets: input.include_facets,
    });

    const hits = hydrateSearchHitsStep({
      hits: searchResult.hits,
      limit: input.limit,
    });

    return new WorkflowResponse({
      hits,
      count: searchResult.count,
      mode: searchResult.mode,
      embeddingDuration,
      searchDuration: searchResult.duration,
      embeddingDimensions: embedding.dimensions,
      facets: searchResult.facets,
    });
  }
);
