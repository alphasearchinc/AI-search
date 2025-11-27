/**
 * FacetBuilder - Builds search facets for filtering UI.
 * Extracted from SearchEngine to follow Single Responsibility Principle.
 */

import {
  CategoryFacet,
  BrandFacet,
  PriceRange,
  OptionFacet,
  SearchFacets,
} from "../../types";
import {
  SearchHit,
  SearchFilters,
  applyFiltersExcluding,
  applyCategoryFilter,
  applyBrandFilter,
  applyPriceFilter,
} from "./filter-pipeline";

/**
 * Build category facets from search hits.
 */
export function buildCategoryFacets(
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
 * Build brand facets from search hits.
 */
export function buildBrandFacets(
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
 * Build price range from search hits.
 */
export function buildPriceRange(
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
 * Build option facets with per-option-type cascading.
 * Each option type is built from hits that match all OTHER selected option types.
 * This ensures selecting "Color: Black" narrows down "Storage" options and vice versa.
 */
export function buildOptionFacetsWithCascading(
  hits: SearchHit[],
  filters: SearchFilters
): OptionFacet[] {
  // First, apply category, brand, and price filters (these always apply)
  let baseHits = hits;
  baseHits = applyCategoryFilter(baseHits, filters.categoryIds);
  baseHits = applyBrandFilter(baseHits, filters.brands);
  baseHits = applyPriceFilter(baseHits, filters.minPrice, filters.maxPrice);

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
  const optionsFilter = filters.options ?? {};
  const selectedOptionTypes = Object.keys(optionsFilter).filter(
    (key) => (optionsFilter[key]?.length ?? 0) > 0
  );

  for (const optionType of allOptionTypes) {
    // Apply all OTHER option filters (exclude this option type)
    let hitsForThisOption = baseHits;

    for (const otherOptionType of selectedOptionTypes) {
      if (otherOptionType === optionType) continue; // Skip self

      const selectedValues = optionsFilter[otherOptionType] ?? [];
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

/**
 * Build all facets with proper cascading.
 * Each facet type is built from hits with ALL OTHER filters applied (except its own).
 */
export function buildAllFacets(
  hits: SearchHit[],
  filters: SearchFilters
): SearchFacets {
  // Category facets: apply brand + price + options filters (exclude category)
  const hitsForCategoryFacets = applyFiltersExcluding(hits, filters, [
    "category",
  ]);

  // Brand facets: apply category + price + options filters (exclude brand)
  const hitsForBrandFacets = applyFiltersExcluding(hits, filters, ["brand"]);

  // Price facets: apply category + brand + options filters (exclude price)
  const hitsForPriceFacets = applyFiltersExcluding(hits, filters, ["price"]);

  // Option facets with per-type cascading
  const optionFacets = buildOptionFacetsWithCascading(hits, filters);

  return {
    categories: buildCategoryFacets(hitsForCategoryFacets),
    brands: buildBrandFacets(hitsForBrandFacets),
    priceRange: buildPriceRange(hitsForPriceFacets),
    options: optionFacets,
  };
}
