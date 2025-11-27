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

    const requestedOffset = options.offset ?? 0;

    // Check if any in-memory filters are applied
    const hasInMemoryFilters =
      (options.filters?.category_ids?.length ?? 0) > 0 ||
      (options.filters?.brands?.length ?? 0) > 0 ||
      options.filters?.min_price !== undefined ||
      options.filters?.max_price !== undefined ||
      (options.filters?.options &&
        Object.keys(options.filters.options).length > 0);

    // When building facets OR when filters are applied, we need to fetch more documents
    // to ensure we have enough results after in-memory filtering for pagination
    // Otherwise facets only reflect the limited result set
    const facetFetchSize =
      options.includeFacets || hasInMemoryFilters
        ? 500
        : Math.max(
            requestedOffset + size,
            size * searchConfig.overfetchMultiplier
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
        size: facetFetchSize,
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
        size: facetFetchSize,
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

    // Filter order for proper cascading:
    // 1. Category filter first (main cascade - narrows down brand/option/price facets)
    // 2. Then brand, options, price filters for final results
    // Facets are built from category-filtered hits so users can multi-select within each facet type

    const categoryIds = options.filters?.category_ids?.filter(Boolean) ?? [];
    const brandsFilter = options.filters?.brands ?? [];
    const optionsFilter = options.filters?.options;
    const minPrice = options.filters?.min_price;
    const maxPrice = options.filters?.max_price;

    // Step 1: Apply category filter first
    let categoryFilteredHits = filteredHits;
    if (categoryIds.length > 0) {
      categoryFilteredHits = filteredHits.filter((hit) => {
        const hitCategoryIds = hit.metadata?.category_ids ?? [];
        return categoryIds.some((catId) => hitCategoryIds.includes(catId));
      });
    }

    // Step 2: Apply price filter
    let priceFilteredHits = categoryFilteredHits;
    if (minPrice !== undefined || maxPrice !== undefined) {
      priceFilteredHits = categoryFilteredHits.filter((hit) => {
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

    // Step 3: Apply brand filter
    let brandFilteredHits = priceFilteredHits;
    if (brandsFilter.length > 0) {
      brandFilteredHits = priceFilteredHits.filter((hit) => {
        const hitBrand = hit.metadata?.brand as string | undefined;
        if (!hitBrand) return false;
        return brandsFilter.includes(hitBrand);
      });
    }

    // Step 4: Apply options filter
    let finalFilteredHits = brandFilteredHits;
    if (optionsFilter && Object.keys(optionsFilter).length > 0) {
      finalFilteredHits = brandFilteredHits.filter((hit) => {
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

    // Build facets with full cascading:
    // Each facet type is built from hits with ALL OTHER filters applied (except its own)
    // This ensures selecting any filter updates all other facet counts
    let facets: SearchFacets | undefined;
    if (options.includeFacets) {
      // Helper to apply filters selectively (excluding specific filter types)
      const applyFilters = (
        hits: typeof filteredHits,
        exclude: ("category" | "brand" | "price" | "options")[]
      ) => {
        let result = hits;

        if (!exclude.includes("category") && categoryIds.length > 0) {
          result = result.filter((hit) => {
            const hitCategoryIds = hit.metadata?.category_ids ?? [];
            return categoryIds.some((catId) => hitCategoryIds.includes(catId));
          });
        }

        if (
          !exclude.includes("price") &&
          (minPrice !== undefined || maxPrice !== undefined)
        ) {
          result = result.filter((hit) => {
            const hitMinPrice = hit.metadata?.min_price;
            const hitMaxPrice = hit.metadata?.max_price;
            if (hitMinPrice === undefined && hitMaxPrice === undefined)
              return true;
            const productMinPrice = hitMinPrice ?? 0;
            const productMaxPrice = hitMaxPrice ?? productMinPrice;
            if (minPrice !== undefined && productMaxPrice < minPrice)
              return false;
            if (maxPrice !== undefined && productMinPrice > maxPrice)
              return false;
            return true;
          });
        }

        if (!exclude.includes("brand") && brandsFilter.length > 0) {
          result = result.filter((hit) => {
            const hitBrand = hit.metadata?.brand as string | undefined;
            if (!hitBrand) return false;
            return brandsFilter.includes(hitBrand);
          });
        }

        if (
          !exclude.includes("options") &&
          optionsFilter &&
          Object.keys(optionsFilter).length > 0
        ) {
          result = result.filter((hit) => {
            const hitOptions = hit.metadata?.options as
              | Record<string, string[]>
              | undefined;
            if (!hitOptions) return false;
            for (const [optionName, selectedValues] of Object.entries(
              optionsFilter
            )) {
              if (!selectedValues || selectedValues.length === 0) continue;
              const productOptionValues = hitOptions[optionName] ?? [];
              const hasMatch = selectedValues.some((val) =>
                productOptionValues.includes(val)
              );
              if (!hasMatch) return false;
            }
            return true;
          });
        }

        return result;
      };

      // Category facets: apply brand + price + options filters (exclude category)
      const hitsForCategoryFacets = applyFilters(filteredHits, ["category"]);

      // Brand facets: apply category + price + options filters (exclude brand)
      const hitsForBrandFacets = applyFilters(filteredHits, ["brand"]);

      // Price facets: apply category + brand + options filters (exclude price)
      const hitsForPriceFacets = applyFilters(filteredHits, ["price"]);

      // For option facets, we need per-option-type cascading:
      // Each option type should be built from hits with all OTHER option types applied
      // This way selecting "Color: Black" narrows down "Storage" options and vice versa
      const hitsForOptionFacets = applyFilters(filteredHits, ["options"]);

      // Build option facets with per-type exclusion for proper cascading
      const optionFacets = this.buildOptionFacetsWithCascading(
        filteredHits,
        categoryIds,
        brandsFilter,
        minPrice,
        maxPrice,
        optionsFilter
      );

      const categoryFacets = this.buildCategoryFacetsFromHits(
        hitsForCategoryFacets
      );
      const brands = this.buildBrandFacetsFromHits(hitsForBrandFacets);
      const priceRange = this.buildPriceRangeFromHits(hitsForPriceFacets);

      facets = {
        categories: categoryFacets,
        brands,
        priceRange,
        options: optionFacets,
      };
    }

    // Apply pagination (offset and limit)
    const offset = options.offset ?? 0;
    const paginatedHits = finalFilteredHits.slice(offset, offset + size);
    const count = finalFilteredHits.length;
    const took = tookParts.reduce((sum, value) => sum + value, 0);

    return {
      hits: paginatedHits,
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

  /**
   * Build option facets with per-option-type cascading.
   * Each option type is built from hits that match all OTHER selected option types.
   * This ensures selecting "Color: Black" narrows down "Storage" options and vice versa.
   */
  private buildOptionFacetsWithCascading(
    hits: Array<{ score: number; metadata?: Record<string, any> }>,
    categoryIds: string[],
    brandsFilter: string[],
    minPrice: number | undefined,
    maxPrice: number | undefined,
    optionsFilter: Record<string, string[]> | undefined
  ): OptionFacet[] {
    // First, apply category, brand, and price filters (these always apply)
    let baseHits = hits;

    if (categoryIds.length > 0) {
      baseHits = baseHits.filter((hit) => {
        const hitCategoryIds = hit.metadata?.category_ids ?? [];
        return categoryIds.some((catId) => hitCategoryIds.includes(catId));
      });
    }

    if (brandsFilter.length > 0) {
      baseHits = baseHits.filter((hit) => {
        const hitBrand = hit.metadata?.brand as string | undefined;
        return hitBrand && brandsFilter.includes(hitBrand);
      });
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      baseHits = baseHits.filter((hit) => {
        const hitMinPrice = hit.metadata?.min_price;
        const hitMaxPrice = hit.metadata?.max_price;
        if (hitMinPrice === undefined && hitMaxPrice === undefined) return true;
        const productMinPrice = hitMinPrice ?? 0;
        const productMaxPrice = hitMaxPrice ?? productMinPrice;
        if (minPrice !== undefined && productMaxPrice < minPrice) return false;
        if (maxPrice !== undefined && productMinPrice > maxPrice) return false;
        return true;
      });
    }

    // Discover all option types from the base hits
    const allOptionTypes = new Set<string>();
    for (const hit of baseHits) {
      const hitOptions = hit.metadata?.options as
        | Record<string, string[]>
        | undefined;
      if (hitOptions) {
        for (const optionName of Object.keys(hitOptions)) {
          allOptionTypes.add(optionName);
        }
      }
    }

    // Build facets for each option type
    const optionFacets: OptionFacet[] = [];
    const selectedOptionTypes = Object.keys(optionsFilter ?? {}).filter(
      (key) => (optionsFilter?.[key]?.length ?? 0) > 0
    );

    for (const optionType of allOptionTypes) {
      // Apply all OTHER option filters (exclude this option type)
      let hitsForThisOption = baseHits;

      for (const otherOptionType of selectedOptionTypes) {
        if (otherOptionType === optionType) continue; // Skip self

        const selectedValues = optionsFilter?.[otherOptionType] ?? [];
        if (selectedValues.length === 0) continue;

        hitsForThisOption = hitsForThisOption.filter((hit) => {
          const hitOptions = hit.metadata?.options as
            | Record<string, string[]>
            | undefined;
          if (!hitOptions) return false;
          const productValues = hitOptions[otherOptionType] ?? [];
          return selectedValues.some((val) => productValues.includes(val));
        });
      }

      // Build the facet values for this option type
      const valueMap = new Map<string, number>();
      for (const hit of hitsForThisOption) {
        const hitOptions = hit.metadata?.options as
          | Record<string, string[]>
          | undefined;
        if (!hitOptions) continue;
        const values = hitOptions[optionType];
        if (!Array.isArray(values)) continue;

        for (const value of values) {
          const currentCount = valueMap.get(value) ?? 0;
          valueMap.set(value, currentCount + 1);
        }
      }

      // Only include option types that have values
      if (valueMap.size > 0) {
        optionFacets.push({
          name: optionType,
          values: Array.from(valueMap.entries())
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count),
        });
      }
    }

    return optionFacets.sort((a, b) => a.name.localeCompare(b.name));
  }
}
