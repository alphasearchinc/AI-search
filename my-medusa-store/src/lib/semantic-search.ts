import {
  elasticsearchClient,
  PRODUCT_EMBEDDINGS_INDEX,
} from "../modules/elasticsearch-client";

export type SemanticSearchFilters = {
  product_ids?: string[];
};

export type SearchMode = "hybrid" | "bm25" | "vector";

export type EmbeddingInput = {
  vectors: number[];
  dimensions: number;
};

export type SemanticSearchOptions = {
  query: string;
  embedding?: EmbeddingInput;
  limit?: number;
  filters?: SemanticSearchFilters;
  includeEmbedding?: boolean;
  mode?: SearchMode;
  minConfidence?: number;
};

export type SemanticSearchHit = {
  id: string;
  product_id?: string;
  score: number; // final combined score
  bm25_score?: number;
  vector_score?: number;
  embedded_text?: string;
  metadata?: Record<string, any>;
  generated_at?: string;
  embedding?: {
    vectors: number[];
    dimensions: number;
  };
  confidence?: number;
};

export type SemanticSearchResult = {
  hits: SemanticSearchHit[];
  count: number;
  took: number;
  mode: SearchMode | "bm25-only";
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_VECTOR_WEIGHT = 0.7;
const DEFAULT_BM25_WEIGHT = 0.3;
const OVERFETCH_MULTIPLIER = 3; // fetch a bit more from ES before re-ranking locally
const DEFAULT_MIN_CONFIDENCE = 1;

export async function semanticSearch(
  options: SemanticSearchOptions
): Promise<SemanticSearchResult> {
  const hasEmbedding =
    options.embedding &&
    Array.isArray(options.embedding.vectors) &&
    !options.embedding.vectors.some((value) => typeof value !== "number");

  const requestedMode: SearchMode = options.mode ?? "hybrid";
  if ((requestedMode === "hybrid" || requestedMode === "vector") && !hasEmbedding) {
    if (requestedMode === "vector") {
      throw new Error("A numeric embedding vector is required for vector search");
    }
  }

  const resolvedMode: SearchMode | "bm25-only" =
    hasEmbedding || requestedMode === "bm25" ? requestedMode : "bm25-only";

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

  const boolFilter =
    filterClauses.length > 0 ? { bool: { filter: filterClauses } } : null;

  const parseWeight = (raw: string | undefined, fallback: number) => {
    const parsed = Number.parseFloat(raw ?? "");
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    return fallback;
  };

  const parseMinConfidence = (raw: string | undefined, fallback: number) => {
    const parsed = Number.parseFloat(raw ?? "");
    if (Number.isFinite(parsed)) {
      return Math.min(Math.max(parsed, 0), 1);
    }
    return fallback;
  };

  const rawVectorWeight = parseWeight(
    process.env.HYBRID_VECTOR_WEIGHT,
    DEFAULT_VECTOR_WEIGHT
  );
  const rawBm25Weight = parseWeight(
    process.env.HYBRID_BM25_WEIGHT,
    DEFAULT_BM25_WEIGHT
  );

  const weightSum = rawVectorWeight + rawBm25Weight;
  const vectorWeight = weightSum > 0 ? rawVectorWeight / weightSum : DEFAULT_VECTOR_WEIGHT;
  const bm25Weight = weightSum > 0 ? rawBm25Weight / weightSum : DEFAULT_BM25_WEIGHT;

  const minConfidence = Math.min(
    Math.max(
      typeof options.minConfidence === "number"
        ? options.minConfidence
        : parseMinConfidence(
            process.env.SEMANTIC_SEARCH_MIN_CONFIDENCE,
            DEFAULT_MIN_CONFIDENCE
          ),
      0
    ),
    1
  );

  const bm25Query = {
    bool: {
      must: [
        {
          match: {
            embedded_text: options.query,
          },
        },
      ],
      ...(boolFilter ? { filter: filterClauses } : {}),
    },
  };

  const baseVectorQuery = boolFilter ? { bool: { filter: filterClauses } } : { match_all: {} };

  const hitsMap = new Map<
    string,
    {
      source?: Record<string, any>;
      bm25_score?: number;
      vector_score?: number;
      combined?: number;
    }
  >();

  const tookParts: number[] = [];

  const getTotal = (total: any, fallback: number) => {
    if (typeof total === "number") {
      return total;
    }
    if (typeof total?.value === "number") {
      return total.value;
    }
    return fallback;
  };

  let bm25Total = 0;
  let vectorTotal = 0;
  let maxBm25Score = 0;
  let maxVectorScore = 0;

  if (resolvedMode !== "vector") {
    const bm25Response = await elasticsearchClient.search({
      index: PRODUCT_EMBEDDINGS_INDEX,
      size: Math.max(size, size * OVERFETCH_MULTIPLIER),
      track_total_hits: true,
      query: bm25Query,
      _source: sourceFields,
    });

    tookParts.push(bm25Response.took ?? 0);
    bm25Total = getTotal(bm25Response.hits.total, 0);

    for (const hit of bm25Response.hits.hits ?? []) {
      const source = (hit._source || {}) as Record<string, any>;
      const current = hitsMap.get(hit._id) || {};
      current.source = current.source || source;
      current.bm25_score = typeof hit._score === "number" ? hit._score : 0;
      maxBm25Score = Math.max(maxBm25Score, current.bm25_score);
      hitsMap.set(hit._id, current);
    }
  }

  if (resolvedMode !== "bm25" && hasEmbedding && options.embedding) {
    const vectorResponse = await elasticsearchClient.search({
      index: PRODUCT_EMBEDDINGS_INDEX,
      size: Math.max(size, size * OVERFETCH_MULTIPLIER),
      track_total_hits: true,
      query: {
        script_score: {
          query: baseVectorQuery,
          script: {
            source: `
              if (doc['embedding_vector'].size() == 0) { return 0; }
              double vectorScore = cosineSimilarity(params.query_vector, 'embedding_vector') + 1.0;
              return Math.max(vectorScore, 0);
            `,
            params: {
              query_vector: options.embedding.vectors,
            },
          },
        },
      },
      _source: sourceFields,
    });

    tookParts.push(vectorResponse.took ?? 0);
    vectorTotal = getTotal(vectorResponse.hits.total, 0);

    for (const hit of vectorResponse.hits.hits ?? []) {
      const source = (hit._source || {}) as Record<string, any>;
      const current = hitsMap.get(hit._id) || {};
      current.source = current.source || source;
      current.vector_score = typeof hit._score === "number" ? hit._score : 0;
      maxVectorScore = Math.max(maxVectorScore, current.vector_score);
      hitsMap.set(hit._id, current);
    }
  }

  const hits = Array.from(hitsMap.entries()).map(([id, data]) => {
    const normalizedBm25 = maxBm25Score > 0 ? (data.bm25_score ?? 0) / maxBm25Score : 0;
    // cosineSimilarity + 1.0 returns a score in the range [0, 2], so divide by 2 to normalize
    const normalizedVector = Math.min((data.vector_score ?? 0) / 2, 1);

    const availableVectorWeight = data.vector_score !== undefined ? vectorWeight : 0;
    const availableBm25Weight = data.bm25_score !== undefined ? bm25Weight : 0;
    const availableWeightSum = availableVectorWeight + availableBm25Weight || 1;

    const confidence =
      (normalizedVector * availableVectorWeight +
        normalizedBm25 * availableBm25Weight) /
      availableWeightSum;

    const combinedScore =
      (data.vector_score ?? 0) * vectorWeight +
      (data.bm25_score ?? 0) * bm25Weight;

    return {
      id,
      product_id: data.source?.product_id,
      score: combinedScore,
      bm25_score: data.bm25_score,
      vector_score: data.vector_score,
      confidence,
      embedded_text: data.source?.embedded_text,
      metadata: data.source?.metadata,
      generated_at: data.source?.generated_at,
      embedding:
        options.includeEmbedding && data.source?.embedding
          ? data.source.embedding
          : undefined,
    };
  });

  const filteredHits = hits.filter((hit) => hit.confidence >= minConfidence);

  filteredHits.sort((a, b) => b.score - a.score);

  const finalHits = filteredHits.slice(0, size);
  const count = filteredHits.length;
  const took = tookParts.reduce((sum, value) => sum + value, 0);

  return {
    hits: finalHits,
    count,
    took,
    mode: resolvedMode,
  };
}
