import { Client } from "@elastic/elasticsearch";
import {
  ElasticsearchModuleOptions,
  SemanticSearchOptions,
  SemanticSearchResult,
  SearchMode,
  CategoryFacet,
  BrandFacet,
  SearchFacets,
  PriceRange,
  OptionFacet,
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
    const categoryIds = options.filters?.category_ids?.filter(Boolean) ?? [];

    // Only apply product_id filter at ES level
    // Category filtering is done in-memory to allow smart facets
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

    // Apply price range filter first (before building facets)
    const minPrice = options.filters?.min_price;
    const maxPrice = options.filters?.max_price;
    let priceFilteredHits = filteredHits;

    if (minPrice !== undefined || maxPrice !== undefined) {
      priceFilteredHits = filteredHits.filter((hit) => {
        const hitMinPrice = hit.metadata?.min_price;
        const hitMaxPrice = hit.metadata?.max_price;

        // If product has no price indexed, include it (don't exclude due to missing data)
        if (hitMinPrice === undefined && hitMaxPrice === undefined) return true;

        const productMinPrice = hitMinPrice ?? 0;
        const productMaxPrice = hitMaxPrice ?? productMinPrice;

        // Check if product's price range overlaps with the filter range
        if (minPrice !== undefined && productMaxPrice < minPrice) return false;
        if (maxPrice !== undefined && productMinPrice > maxPrice) return false;
        return true;
      });
    }

    // Apply brand filter (before options filter)
    const brandsFilter = options.filters?.brands ?? [];
    let brandFilteredHits = priceFilteredHits;

    if (brandsFilter.length > 0) {
      brandFilteredHits = priceFilteredHits.filter((hit) => {
        const hitBrand = hit.metadata?.brand as string | undefined;
        if (!hitBrand) return false;
        return brandsFilter.includes(hitBrand);
      });
    }

    // Apply options filter (before building facets)
    const optionsFilter = options.filters?.options;
    let optionsFilteredHits = brandFilteredHits;

    if (optionsFilter && Object.keys(optionsFilter).length > 0) {
      optionsFilteredHits = brandFilteredHits.filter((hit) => {
        const hitOptions = hit.metadata?.options as
          | Record<string, string[]>
          | undefined;
        if (!hitOptions) return false;

        // Product must match ALL selected option filters (AND between option types)
        // But can match ANY value within an option type (OR within option values)
        for (const [optionName, selectedValues] of Object.entries(
          optionsFilter
        )) {
          if (!selectedValues || selectedValues.length === 0) continue;

          const productOptionValues = hitOptions[optionName] ?? [];
          // Check if product has at least one of the selected values for this option
          const hasMatch = selectedValues.some((val) =>
            productOptionValues.includes(val)
          );
          if (!hasMatch) return false;
        }
        return true;
      });
    }

    // Now apply category filter
    let categoryFilteredHits = optionsFilteredHits;
    if (categoryIds.length > 0) {
      categoryFilteredHits = optionsFilteredHits.filter((hit) => {
        const hitCategoryIds = hit.metadata?.category_ids ?? [];
        return categoryIds.some((catId) => hitCategoryIds.includes(catId));
      });
    }

    // Build facets from category-filtered hits
    // This ensures brands/options/price update when a category is selected
    let facets: SearchFacets | undefined;
    if (options.includeFacets) {
      // Category facets from pre-category-filter hits (so user can see all categories)
      const categoryFacets =
        this.buildCategoryFacetsFromHits(optionsFilteredHits);
      // Other facets from post-category-filter hits (so they reflect selected category)
      const brands = this.buildBrandFacetsFromHits(categoryFilteredHits);
      const priceRange = this.buildPriceRangeFromHits(categoryFilteredHits);
      const options = this.buildOptionFacetsFromHits(categoryFilteredHits);

      facets = { categories: categoryFacets, brands, priceRange, options };
    }

    const finalHits = categoryFilteredHits.slice(0, size);
    const count = categoryFilteredHits.length;
    const took = tookParts.reduce((sum, value) => sum + value, 0);

    return {
      hits: finalHits,
      count,
      took,
      mode: resolvedMode,
      facets,
    };
  }

  /**
   * Build category facets from search hits.
   */
  private buildCategoryFacetsFromHits(
    hits: Array<{ metadata?: Record<string, any> }>
  ): CategoryFacet[] {
    const categoryMap = new Map<string, { name: string; count: number }>();

    for (const hit of hits) {
      const categoryIds = hit.metadata?.category_ids ?? [];
      const categoryNames = hit.metadata?.categories ?? [];

      for (let i = 0; i < categoryIds.length; i++) {
        const id = categoryIds[i];
        const name = categoryNames[i] || id;

        const existing = categoryMap.get(id);
        if (existing) {
          existing.count++;
        } else {
          categoryMap.set(id, { name, count: 1 });
        }
      }
    }

    return Array.from(categoryMap.entries())
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Build price range from search hits.
   */
  private buildPriceRangeFromHits(
    hits: Array<{ metadata?: Record<string, any> }>
  ): PriceRange | undefined {
    const prices: number[] = [];
    for (const hit of hits) {
      if (typeof hit.metadata?.min_price === "number") {
        prices.push(hit.metadata.min_price);
      }
      if (typeof hit.metadata?.max_price === "number") {
        prices.push(hit.metadata.max_price);
      }
    }
    if (prices.length > 0) {
      return {
        min: Math.min(...prices),
        max: Math.max(...prices),
      };
    }
    return undefined;
  }

  /**
   * Build brand facets from search hits.
   */
  private buildBrandFacetsFromHits(
    hits: Array<{ metadata?: Record<string, any> }>
  ): BrandFacet[] {
    const brandMap = new Map<string, number>();

    for (const hit of hits) {
      const brand = hit.metadata?.brand as string | undefined;
      if (!brand) continue;

      const currentCount = brandMap.get(brand) ?? 0;
      brandMap.set(brand, currentCount + 1);
    }

    return Array.from(brandMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Build option facets from search hits.
   * Discovers all unique option types and their values with counts.
   */
  private buildOptionFacetsFromHits(
    hits: Array<{ metadata?: Record<string, any> }>
  ): OptionFacet[] {
    const optionMap = new Map<string, Map<string, number>>();

    for (const hit of hits) {
      const hitOptions = hit.metadata?.options as
        | Record<string, string[]>
        | undefined;
      if (!hitOptions) continue;

      for (const [optionName, values] of Object.entries(hitOptions)) {
        if (!Array.isArray(values)) continue;

        let valueMap = optionMap.get(optionName);
        if (!valueMap) {
          valueMap = new Map<string, number>();
          optionMap.set(optionName, valueMap);
        }

        for (const value of values) {
          const currentCount = valueMap.get(value) ?? 0;
          valueMap.set(value, currentCount + 1);
        }
      }
    }

    return Array.from(optionMap.entries())
      .map(([name, valueMap]) => ({
        name,
        values: Array.from(valueMap.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
