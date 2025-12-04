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
 * Build a BM25 text search query with optional fuzzy matching and field boosting.
 * 
 * Boosting strategy:
 * - Title: 3.0x (highest priority for exact product names)
 * - Brand: 2.5x (high priority for brand searches)
 * - Categories: 2.0x (important for category-based searches)
 * - Tags: 1.5x (moderate boost for feature/use-case tags)
 * - Embedded text: 1.0x (baseline for full content)
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
      should: [
        // Boost title matches highest (e.g., "iPhone 15 Pro")
        {
          match: {
            "metadata.title": {
              ...(typeof matchQuery === "object" ? matchQuery : { query: matchQuery }),
              boost: 3.0,
            },
          },
        },
        // Boost brand matches (e.g., "Apple laptop")
        {
          match: {
            "metadata.brand": {
              ...(typeof matchQuery === "object" ? matchQuery : { query: matchQuery }),
              boost: 2.5,
            },
          },
        },
        // Boost category matches (e.g., "laptops")
        {
          match: {
            "metadata.categories": {
              ...(typeof matchQuery === "object" ? matchQuery : { query: matchQuery }),
              boost: 2.0,
            },
          },
        },
        // Boost tag matches (e.g., "waterproof", "gaming")
        {
          match: {
            "metadata.tags": {
              ...(typeof matchQuery === "object" ? matchQuery : { query: matchQuery }),
              boost: 1.5,
            },
          },
        },
        // Standard embedded text match (baseline)
        {
          match: {
            embedded_text: matchQuery,
          },
        },
      ],
      minimum_should_match: 1,
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
