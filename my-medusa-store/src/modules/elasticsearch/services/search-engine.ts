import { Client } from "@elastic/elasticsearch";
import {
  ElasticsearchModuleOptions,
  SemanticSearchOptions,
  SemanticSearchResult,
  SearchMode,
} from "../types";
import {
  getSearchConfig,
  getFuzzyConfig,
  parseWeight,
  parseMinConfidence,
} from "../utils/config";
import { calculateScore } from "../utils/scoring";

export class SearchEngine {
  private client: Client;
  private options: ElasticsearchModuleOptions;
  private indexName: string;

  constructor(
    client: Client,
    indexName: string,
    options: ElasticsearchModuleOptions
  ) {
    this.client = client;
    this.indexName = indexName;
    this.options = options;
  }

  async search(options: SemanticSearchOptions): Promise<SemanticSearchResult> {
    const hasEmbedding =
      options.embedding &&
      Array.isArray(options.embedding.vectors) &&
      !options.embedding.vectors.some((value) => typeof value !== "number");

    const requestedMode: SearchMode = options.mode ?? "hybrid";
    if (
      (requestedMode === "hybrid" || requestedMode === "vector") &&
      !hasEmbedding
    ) {
      if (requestedMode === "vector") {
        throw new Error(
          "A numeric embedding vector is required for vector search"
        );
      }
    }

    const resolvedMode: SearchMode | "bm25-only" =
      hasEmbedding || requestedMode === "bm25" ? requestedMode : "bm25-only";

    const searchConfig = getSearchConfig(this.options);

    const size = Math.max(
      1,
      Math.min(
        options.limit ?? searchConfig.defaultLimit,
        searchConfig.maxLimit
      )
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

    const filterClauses: any[] = [];
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

    const rawVectorWeight = parseWeight(
      process.env.HYBRID_VECTOR_WEIGHT,
      searchConfig.vectorWeight
    );
    const rawBm25Weight = parseWeight(
      process.env.HYBRID_BM25_WEIGHT,
      searchConfig.bm25Weight
    );

    const weightSum = rawVectorWeight + rawBm25Weight;
    const vectorWeight =
      weightSum > 0 ? rawVectorWeight / weightSum : searchConfig.vectorWeight;
    const bm25Weight =
      weightSum > 0 ? rawBm25Weight / weightSum : searchConfig.bm25Weight;

    const fuzzyConfig = getFuzzyConfig(this.options);
    const fuzzyEnabled =
      process.env.SEARCH_FUZZY_ENABLED !== "false" && fuzzyConfig.enabled;
    const fuzzinessLevel =
      process.env.SEARCH_FUZZINESS_LEVEL || fuzzyConfig.fuzzinessLevel;
    const prefixLength = parseWeight(
      process.env.SEARCH_PREFIX_LENGTH,
      fuzzyConfig.prefixLength
    );
    const maxExpansions = parseWeight(
      process.env.SEARCH_MAX_EXPANSIONS,
      fuzzyConfig.maxExpansions
    );

    const minConfidence =
      typeof options.minConfidence === "number"
        ? parseMinConfidence(
            String(options.minConfidence),
            searchConfig.minConfidence
          )
        : parseMinConfidence(
            process.env.SEMANTIC_SEARCH_MIN_CONFIDENCE,
            searchConfig.minConfidence
          );

    const bm25Query = {
      bool: {
        must: [
          {
            match: {
              embedded_text: fuzzyEnabled
                ? {
                    query: options.query,
                    fuzziness: fuzzinessLevel,
                    prefix_length: prefixLength,
                    max_expansions: maxExpansions,
                  }
                : options.query,
            },
          },
        ],
        ...(boolFilter ? { filter: filterClauses } : {}),
      },
    };

    const baseVectorQuery = boolFilter
      ? { bool: { filter: filterClauses } }
      : { match_all: {} };

    const hitsMap = new Map<
      string,
      {
        source?: Record<string, any>;
        bm25_score?: number;
        vector_score?: number;
      }
    >();

    const tookParts: number[] = [];

    let maxBm25Score = 0;
    let maxVectorScore = 0;

    if (resolvedMode !== "vector") {
      const bm25Response = await this.client.search({
        index: this.indexName,
        size: Math.max(size, size * searchConfig.overfetchMultiplier),
        track_total_hits: true,
        query: bm25Query,
        _source: sourceFields,
      });

      tookParts.push(bm25Response.took ?? 0);

      for (const hit of bm25Response.hits.hits ?? []) {
        if (!hit._id) continue;
        const source = (hit._source || {}) as Record<string, any>;
        const current = hitsMap.get(hit._id) || {};
        current.source = current.source || source;
        current.bm25_score = typeof hit._score === "number" ? hit._score : 0;
        maxBm25Score = Math.max(maxBm25Score, current.bm25_score);
        hitsMap.set(hit._id, current);
      }
    }

    if (resolvedMode !== "bm25" && hasEmbedding && options.embedding) {
      const vectorResponse = await this.client.search({
        index: this.indexName,
        size: Math.max(size, size * searchConfig.overfetchMultiplier),
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

      for (const hit of vectorResponse.hits.hits ?? []) {
        if (!hit._id) continue;
        const source = (hit._source || {}) as Record<string, any>;
        const current = hitsMap.get(hit._id) || {};
        current.source = current.source || source;
        current.vector_score = typeof hit._score === "number" ? hit._score : 0;
        maxVectorScore = Math.max(maxVectorScore, current.vector_score);
        hitsMap.set(hit._id, current);
      }
    }

    const hits = Array.from(hitsMap.entries()).map(([id, data]) => {
      const { confidence, combinedScore } = calculateScore(
        data,
        maxBm25Score,
        maxVectorScore,
        vectorWeight,
        bm25Weight
      );

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
}
