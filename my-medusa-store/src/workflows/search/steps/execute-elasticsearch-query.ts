import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ELASTICSEARCH_MODULE } from "../../../modules/elasticsearch";
import type ElasticsearchModuleService from "../../../modules/elasticsearch/service";

type ExecuteElasticsearchQueryInput = {
  query: string;
  embedding: { vectors: number[]; dimensions: number };
  mode: "hybrid" | "bm25-only";
  limit: number;
  filters?: { product_ids?: string[] };
  minConfidence?: number;
  includeEmbedding?: boolean;
};

type SearchResult = {
  hits: any[];
  count: number;
  took: number;
  mode: "hybrid" | "bm25" | "vector";
};

/**
 * Step to execute semantic search query in Elasticsearch.
 */
export const executeElasticsearchQueryStep = createStep(
  "execute-elasticsearch-query",
  async (input: ExecuteElasticsearchQueryInput, { container }) => {
    const logger = container.resolve("logger");
    const elasticsearchService: ElasticsearchModuleService = container.resolve(
      ELASTICSEARCH_MODULE
    );

    const {
      query,
      embedding,
      mode,
      limit,
      filters,
      minConfidence,
      includeEmbedding = false,
    } = input;

    const searchResult = await elasticsearchService.semanticSearch({
      query,
      embedding: mode === "bm25-only" ? undefined : embedding,
      limit,
      filters,
      includeEmbedding,
      mode: mode === "bm25-only" ? "bm25" : "hybrid",
      minConfidence,
    });

    logger.debug(
      `[Search] Elasticsearch query completed: ${searchResult.count} hits in ${searchResult.took}ms`
    );

    return new StepResponse({
      hits: searchResult.hits,
      count: searchResult.count,
      took: searchResult.took,
      mode: searchResult.mode,
    });
  }
);
