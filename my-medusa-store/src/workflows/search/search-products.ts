import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { generateEmbeddingStep } from "./steps/generate-embedding";
import { searchIndexStep } from "./steps/search-index";
import { hydrateSearchHitsStep } from "./steps/hydrate-search-hits";

type SearchProductsWorkflowInput = {
  query: string;
  limit: number;
  min_confidence?: number;
};

export const searchProductsWorkflow = createWorkflow(
  "search-products",
  function (input: SearchProductsWorkflowInput) {
    const { embedding, mode, duration: embeddingDuration } = generateEmbeddingStep({ query: input.query });
    
    const searchResult = searchIndexStep({
      query: input.query,
      embedding,
      limit: input.limit,
      mode,
      minConfidence: input.min_confidence,
    });

    const hits = hydrateSearchHitsStep({
      hits: searchResult.hits,
      limit: input.limit
    });

    return new WorkflowResponse({
      hits,
      count: searchResult.count,
      mode: searchResult.mode,
      embeddingDuration,
      searchDuration: searchResult.duration,
      embeddingDimensions: embedding.dimensions,
    });
  }
);
