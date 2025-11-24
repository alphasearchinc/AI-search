import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ELASTICSEARCH_MODULE } from "../../../modules/elasticsearch";
import ElasticsearchModuleService from "../../../modules/elasticsearch/services/main";
import { EmbeddingResult } from "../../../lib/embedding-client";
import { SearchMode } from "../../../modules/elasticsearch/types";

type SearchIndexInput = {
  query: string;
  embedding: EmbeddingResult;
  limit: number;
  mode: SearchMode | "bm25-only";
  minConfidence?: number;
};

export type SearchIndexOutput = {
  hits: any[];
  count: number;
  mode: SearchMode;
  duration: number;
};

export const searchIndexStep = createStep(
  "search-index-step",
  async (input: SearchIndexInput, { container }) => {
    const elasticsearchService: ElasticsearchModuleService =
      container.resolve(ELASTICSEARCH_MODULE);
    const startTime = Date.now();

    const searchResult = await elasticsearchService.semanticSearch({
      query: input.query,
      embedding: input.embedding,
      limit: input.limit,
      includeEmbedding: false,
      mode: input.mode === "bm25-only" ? "bm25" : "hybrid",
      minConfidence: input.minConfidence,
    });

    const duration = Date.now() - startTime;

    return new StepResponse({
      hits: searchResult.hits,
      count: searchResult.count,
      mode: searchResult.mode,
      duration,
    } as SearchIndexOutput);
  }
);
