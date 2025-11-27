/**
 * FilterPipeline - Handles in-memory filtering of search hits with cascading logic.
 * Extracted from SearchEngine to follow Single Responsibility Principle.
 */

export type FilterType = "category" | "brand" | "price" | "options";

export type SearchFilters = {
  categoryIds: string[];
  brands: string[];
  minPrice: number | undefined;
  maxPrice: number | undefined;
  options: Record<string, string[]> | undefined;
};

export type SearchHit = {
  id: string;
  product_id?: string;
  score: number;
  bm25_score?: number;
  vector_score?: number;
  confidence: number;
  embedded_text?: string;
  metadata?: Record<string, any>;
  generated_at?: string;
  embedding?: any;
};

/**
 * Apply category filter to hits.
 */
export function applyCategoryFilter(
  hits: SearchHit[],
  categoryIds: string[]
): SearchHit[] {
  if (categoryIds.length === 0) return hits;

  return hits.filter((hit) => {
    const hitCategoryIds = hit.metadata?.category_ids ?? [];
    return categoryIds.some((catId) => hitCategoryIds.includes(catId));
  });
}

/**
 * Apply price filter to hits.
 */
export function applyPriceFilter(
  hits: SearchHit[],
  minPrice: number | undefined,
  maxPrice: number | undefined
): SearchHit[] {
  if (minPrice === undefined && maxPrice === undefined) return hits;

  return hits.filter((hit) => {
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

/**
 * Apply brand filter to hits.
 */
export function applyBrandFilter(
  hits: SearchHit[],
  brands: string[]
): SearchHit[] {
  if (brands.length === 0) return hits;

  return hits.filter((hit) => {
    const hitBrand = hit.metadata?.brand as string | undefined;
    if (!hitBrand) return false;
    return brands.includes(hitBrand);
  });
}

/**
 * Apply options filter to hits.
 * Product must match ALL selected option filters (AND between option types)
 * But can match ANY value within an option type (OR within option values)
 */
export function applyOptionsFilter(
  hits: SearchHit[],
  options: Record<string, string[]> | undefined
): SearchHit[] {
  if (!options || Object.keys(options).length === 0) return hits;

  return hits.filter((hit) => {
    const hitOptions = hit.metadata?.options as
      | Record<string, string[]>
      | undefined;
    if (!hitOptions) return false;

    for (const [optionName, selectedValues] of Object.entries(options)) {
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

/**
 * Apply all filters in the correct cascading order.
 * Order: category → price → brand → options
 */
export function applyAllFilters(
  hits: SearchHit[],
  filters: SearchFilters
): SearchHit[] {
  let result = hits;
  result = applyCategoryFilter(result, filters.categoryIds);
  result = applyPriceFilter(result, filters.minPrice, filters.maxPrice);
  result = applyBrandFilter(result, filters.brands);
  result = applyOptionsFilter(result, filters.options);
  return result;
}

/**
 * Apply filters selectively, excluding specific filter types.
 * Used for building facets where each facet type excludes its own filter.
 */
export function applyFiltersExcluding(
  hits: SearchHit[],
  filters: SearchFilters,
  exclude: FilterType[]
): SearchHit[] {
  let result = hits;

  if (!exclude.includes("category")) {
    result = applyCategoryFilter(result, filters.categoryIds);
  }

  if (!exclude.includes("price")) {
    result = applyPriceFilter(result, filters.minPrice, filters.maxPrice);
  }

  if (!exclude.includes("brand")) {
    result = applyBrandFilter(result, filters.brands);
  }

  if (!exclude.includes("options")) {
    result = applyOptionsFilter(result, filters.options);
  }

  return result;
}
