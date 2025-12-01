/**
 * QueryBuilder - Constructs Elasticsearch queries for BM25 and vector search.
 * Extracted from SearchEngine to follow Single Responsibility Principle.
 */

export type FuzzyConfig = {
  enabled: boolean;
  fuzzinessLevel: string;
  prefixLength: number;
  maxExpansions: number;
};

export type QueryBuilderOptions = {
  query: string;
  fuzzyConfig: FuzzyConfig;
  fuzzyEnabled: boolean;
  filterClauses: any[];
};

/**
 * Build a BM25 text search query with optional fuzzy matching.
 */
export function buildBM25Query(options: QueryBuilderOptions): object {
  const { query, fuzzyConfig, fuzzyEnabled, filterClauses } = options;

  const matchQuery = fuzzyEnabled
    ? {
        query,
        fuzziness: fuzzyConfig.fuzzinessLevel,
        prefix_length: fuzzyConfig.prefixLength,
        max_expansions: fuzzyConfig.maxExpansions,
      }
    : query;

  return {
    bool: {
      must: [
        {
          match: {
            embedded_text: matchQuery,
          },
        },
      ],
      ...(filterClauses.length > 0 ? { filter: filterClauses } : {}),
    },
  };
}

/**
 * Build a vector similarity search query using script_score.
 */
export function buildVectorQuery(
  vectors: number[],
  filterClauses: any[]
): object {
  const baseQuery =
    filterClauses.length > 0
      ? { bool: { filter: filterClauses } }
      : { match_all: {} };

  return {
    script_score: {
      query: baseQuery,
      script: {
        source: `
          if (doc['embedding_vector'].size() == 0) { return 0; }
          double vectorScore = cosineSimilarity(params.query_vector, 'embedding_vector') + 1.0;
          return Math.max(vectorScore, 0);
        `,
        params: {
          query_vector: vectors,
        },
      },
    },
  };
}

/**
 * Build product ID filter clause for Elasticsearch.
 */
export function buildProductIdFilter(productIds: string[]): object | null {
  const validIds = productIds.filter(Boolean);
  if (validIds.length === 0) return null;

  return {
    terms: {
      product_id: validIds,
    },
  };
}

/**
 * Get the list of source fields to retrieve from Elasticsearch.
 */
export function getSourceFields(includeEmbedding: boolean): string[] {
  const fields = [
    "product_id",
    "embedded_text",
    "metadata",
    "generated_at",
  ];

  if (includeEmbedding) {
    fields.push("embedding");
  }

  return fields;
}
