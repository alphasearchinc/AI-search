/**
 * SearchEngine - Orchestrates semantic search across Elasticsearch.
 *
 * This is the main entry point for search operations. It coordinates:
 * - Query building (query-builder.ts)
 * - Result merging and scoring (result-merger.ts)
 * - In-memory filtering (filter-pipeline.ts)
 * - Facet building (facet-builder.ts)
 *
 * Refactored from a 680-line monolith into focused modules.
 */

import { Client } from "@elastic/elasticsearch";
import {
  ElasticsearchModuleOptions,
  SemanticSearchOptions,
  SemanticSearchResult,
  SearchMode,
} from "../../types";
import {
  getSearchConfig,
  getFuzzyConfig,
  parseWeight,
  parseMinConfidence,
} from "../../utils/config";

// Import refactored modules
import {
  buildBM25Query,
  buildVectorQuery,
  buildProductIdFilter,
  getSourceFields,
} from "./query-builder";
import {
  processElasticsearchHits,
  mergeAndScoreHitsHybridNormalized,
  mergeAndScoreHitsBm25,
  mergeAndScoreHitsVector,
  filterByConfidence,
  filterByMinScore,
  sortByScore,
  paginateHits,
  RawHitData,
} from "./result-merger";
import { SearchFilters, applyAllFilters } from "./filter-pipeline";
import { buildAllFacets } from "./facet-builder";

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
    // Resolve search mode based on embedding availability
    const { resolvedMode, hasEmbedding } = this.resolveSearchMode(options);

    // Get configuration
    const searchConfig = getSearchConfig(this.options);
    const { size, fetchSize, minConfidence } = this.calculateSizes(
      options,
      searchConfig
    );
    const { vectorWeight, bm25Weight } = this.calculateWeights(searchConfig);
    const fuzzyConfig = this.getFuzzyConfiguration();

    // Build filter clauses for Elasticsearch
    const filterClauses = this.buildFilterClauses(options);
    const sourceFields = getSourceFields(options.includeEmbedding ?? false);

    // Execute searches and merge results
    const { hitsMap, maxBm25Score, maxVectorScore, tookParts } =
      await this.executeSearches({
        options,
        resolvedMode,
        hasEmbedding,
        fetchSize,
        filterClauses,
        sourceFields,
        fuzzyConfig,
      });

    // Merge, score, and filter hits
    const mergeContext = {
      maxBm25Score,
      maxVectorScore,
      vectorWeight,
      bm25Weight,
      includeEmbedding: options.includeEmbedding ?? false,
    };
    const mergedHits =
      resolvedMode === "hybrid"
        ? mergeAndScoreHitsHybridNormalized(hitsMap, mergeContext)
        : resolvedMode === "vector"
          ? mergeAndScoreHitsVector(hitsMap, mergeContext)
          : mergeAndScoreHitsBm25(hitsMap, mergeContext);

    const confidenceFilteredHits = filterByConfidence(
      mergedHits,
      minConfidence
    );

    // Filter out low-relevance results (minimum score threshold)
    // Skip score filtering when query is empty (browse mode) - show all products
    const isEmptyQuery =
      !options.query || options.query === "*" || options.query.trim() === "";
    const MIN_SCORE_THRESHOLD = 1;
    // Hybrid scores are normalized (0..1). Use minConfidence for hybrid filtering.
    const shouldFilterByScore = !isEmptyQuery && resolvedMode !== "hybrid";
    const scoreFilteredHits = shouldFilterByScore
      ? filterByMinScore(confidenceFilteredHits, MIN_SCORE_THRESHOLD)
      : confidenceFilteredHits;

    const sortedHits = sortByScore(scoreFilteredHits);

    // Build search filters object
    const filters: SearchFilters = {
      categoryIds: options.filters?.category_ids?.filter(Boolean) ?? [],
      brands: options.filters?.brands ?? [],
      tags: options.filters?.tags ?? [],
      minPrice: options.filters?.min_price,
      maxPrice: options.filters?.max_price,
      options: options.filters?.options,
    };

    // Apply all filters for final results
    const finalFilteredHits = applyAllFilters(sortedHits, filters);

    // Build facets if requested
    const facets = options.includeFacets
      ? buildAllFacets(sortedHits, filters)
      : undefined;

    // Apply pagination
    const offset = options.offset ?? 0;
    const paginatedHits = paginateHits(finalFilteredHits, offset, size);
    const took = tookParts.reduce((sum, value) => sum + value, 0);

    return {
      hits: paginatedHits,
      count: finalFilteredHits.length,
      took,
      mode: resolvedMode,
      facets,
    };
  }

  /**
   * Resolve the search mode based on embedding availability.
   */
  private resolveSearchMode(options: SemanticSearchOptions): {
    resolvedMode: SearchMode | "bm25-only";
    hasEmbedding: boolean;
  } {
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

    return { resolvedMode, hasEmbedding: !!hasEmbedding };
  }

  /**
   * Calculate size parameters for the search.
   */
  private calculateSizes(
    options: SemanticSearchOptions,
    searchConfig: ReturnType<typeof getSearchConfig>
  ): { size: number; fetchSize: number; minConfidence: number } {
    const size = Math.max(
      1,
      Math.min(
        options.limit ?? searchConfig.defaultLimit,
        searchConfig.maxLimit
      )
    );

    const requestedOffset = options.offset ?? 0;

    // Check if any in-memory filters are applied
    const hasInMemoryFilters =
      (options.filters?.category_ids?.length ?? 0) > 0 ||
      (options.filters?.brands?.length ?? 0) > 0 ||
      (options.filters?.tags?.length ?? 0) > 0 ||
      options.filters?.min_price !== undefined ||
      options.filters?.max_price !== undefined ||
      (options.filters?.options &&
        Object.keys(options.filters.options).length > 0);

    // When building facets OR when filters are applied, fetch more documents
    const fetchSize =
      options.includeFacets || hasInMemoryFilters
        ? 500
        : Math.max(
            requestedOffset + size,
            size * searchConfig.overfetchMultiplier
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

    return { size, fetchSize, minConfidence };
  }

  /**
   * Calculate normalized search weights.
   */
  private calculateWeights(searchConfig: ReturnType<typeof getSearchConfig>): {
    vectorWeight: number;
    bm25Weight: number;
  } {
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

    return { vectorWeight, bm25Weight };
  }

  /**
   * Get fuzzy search configuration.
   */
  private getFuzzyConfiguration(): {
    enabled: boolean;
    fuzzinessLevel: string;
    prefixLength: number;
    maxExpansions: number;
  } {
    const fuzzyConfig = getFuzzyConfig(this.options);
    const enabled =
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

    return { enabled, fuzzinessLevel, prefixLength, maxExpansions };
  }

  /**
   * Build Elasticsearch filter clauses.
   */
  private buildFilterClauses(options: SemanticSearchOptions): any[] {
    const filterClauses: any[] = [];
    const productIds = options.filters?.product_ids?.filter(Boolean) ?? [];

    const productIdFilter = buildProductIdFilter(productIds);
    if (productIdFilter) {
      filterClauses.push(productIdFilter);
    }

    return filterClauses;
  }

  /**
   * Execute BM25 and/or vector searches against Elasticsearch.
   */
  private async executeSearches(params: {
    options: SemanticSearchOptions;
    resolvedMode: SearchMode | "bm25-only";
    hasEmbedding: boolean;
    fetchSize: number;
    filterClauses: any[];
    sourceFields: string[];
    fuzzyConfig: ReturnType<typeof this.getFuzzyConfiguration>;
  }): Promise<{
    hitsMap: Map<string, RawHitData>;
    maxBm25Score: number;
    maxVectorScore: number;
    tookParts: number[];
  }> {
    const {
      options,
      resolvedMode,
      hasEmbedding,
      fetchSize,
      filterClauses,
      sourceFields,
      fuzzyConfig,
    } = params;

    const hitsMap = new Map<string, RawHitData>();
    const tookParts: number[] = [];
    let maxBm25Score = 0;
    let maxVectorScore = 0;

    // Execute BM25 search
    if (resolvedMode !== "vector") {
      const bm25Query = buildBM25Query({
        query: options.query,
        fuzzyConfig,
        fuzzyEnabled: fuzzyConfig.enabled,
        filterClauses,
      });

      const bm25Response = await this.client.search({
        index: this.indexName,
        size: fetchSize,
        track_total_hits: true,
        query: bm25Query,
        _source: sourceFields,
      });

      tookParts.push(bm25Response.took ?? 0);
      maxBm25Score = processElasticsearchHits(
        bm25Response.hits.hits ?? [],
        hitsMap,
        "bm25"
      );
    }

    // Execute vector search
    if (resolvedMode !== "bm25" && hasEmbedding && options.embedding) {
      const vectorQuery = buildVectorQuery(
        options.embedding.vectors,
        filterClauses
      );

      const vectorResponse = await this.client.search({
        index: this.indexName,
        size: fetchSize,
        track_total_hits: true,
        query: vectorQuery,
        _source: sourceFields,
      });

      tookParts.push(vectorResponse.took ?? 0);
      maxVectorScore = processElasticsearchHits(
        vectorResponse.hits.hits ?? [],
        hitsMap,
        "vector"
      );
    }

    return { hitsMap, maxBm25Score, maxVectorScore, tookParts };
  }
}
