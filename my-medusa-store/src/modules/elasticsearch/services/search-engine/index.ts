/**
 * Search Engine Module
 *
 * This module provides semantic search capabilities with:
 * - Hybrid BM25 + vector search
 * - In-memory filtering with cascading facets
 * - Result merging and scoring
 *
 * Main export: SearchEngine class
 */

export { SearchEngine } from "./search-engine";
export {
  buildBM25Query,
  buildVectorQuery,
  buildProductIdFilter,
  getSourceFields,
} from "./query-builder";
export {
  processElasticsearchHits,
  mergeAndScoreHits,
  filterByConfidence,
  sortByScore,
  paginateHits,
} from "./result-merger";
export {
  applyAllFilters,
  applyFiltersExcluding,
  type SearchFilters,
  type SearchHit,
  type FilterType,
} from "./filter-pipeline";
export {
  buildAllFacets,
  buildCategoryFacets,
  buildBrandFacets,
  buildPriceRange,
  buildOptionFacetsWithCascading,
} from "./facet-builder";
