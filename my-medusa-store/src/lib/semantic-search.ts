import {
  elasticsearchClient,
  PRODUCT_EMBEDDINGS_INDEX,
} from "../modules/elasticsearch-client";

export type SemanticSearchFilters = {
  product_ids?: string[];
};

export type SemanticSearchOptions = {
  embedding: object;
  limit?: number;
  filters?: SemanticSearchFilters;
  includeEmbedding?: boolean;
};

export type SemanticSearchHit = {
  id: string;
  product_id?: string;
  score: number;
  embedded_text?: string;
  metadata?: Record<string, any>;
  generated_at?: string;
  embedding?: object;
};

export type SemanticSearchResult = {
  hits: SemanticSearchHit[];
  count: number;
  took: number;
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function semanticSearch(
  options: SemanticSearchOptions
): Promise<SemanticSearchResult> {
  if (
    !Array.isArray(options.embedding['vectors']) ||
    options.embedding['vectors'].some((value) => typeof value !== "number")
  ) {
    throw new Error("A numeric embedding vector is required for semantic search");
  }

  const size = Math.max(
    1,
    Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
  );

  const sourceFields = [
    "product_id",
    "embedded_text",
    "metadata",
    "generated_at",
  ];

  if (options.includeEmbedding) {
    sourceFields.push("embedding");
  }

  const filterClauses = [];
  const productIds = options.filters?.product_ids?.filter(Boolean) ?? [];

  if (productIds.length) {
    filterClauses.push({
      terms: {
        product_id: productIds,
      },
    });
  }

  const baseQuery =
    filterClauses.length > 0
      ? { bool: { filter: filterClauses } }
      : { match_all: {} };

  const response = await elasticsearchClient.search({
    index: PRODUCT_EMBEDDINGS_INDEX,
    size,
    track_total_hits: true,
    query: {
      script_score: {
        query: baseQuery,
        script: {
          source:
            "cosineSimilarity(params.query_vector, 'embedding_vector') + 1.0",
          params: {
            query_vector: options.embedding,
          },
        },
      },
    },
    _source: sourceFields,
  });

  const hits =
    response.hits.hits?.map((hit) => {
      const source = (hit._source || {}) as Record<string, any>;
      return {
        id: hit._id,
        product_id: source.product_id,
        score: typeof hit._score === "number" ? hit._score : 0,
        embedded_text: source.embedded_text,
        metadata: source.metadata,
        generated_at: source.generated_at,
        embedding:
          (options.includeEmbedding ? source.embedding : undefined) ||
          undefined,
      };
    }) ?? [];

  const totalHits = response.hits.total;
  const count =
    typeof totalHits === "number"
      ? totalHits
      : totalHits?.value ?? hits.length;

  return {
    hits,
    count,
    took: response.took ?? 0,
  };
}
