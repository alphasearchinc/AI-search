# Search Filters Branch - Complete File Changes Guide

This document explains every file modified or created in the `search-filters` branch, organized by layer (frontend → backend).

---

## Overview

The `search-filters` branch adds **faceted navigation** and **filtering capabilities** to the semantic search feature. Users can now:

- Filter by **categories**, **brands**, **price range**, and **product options** (Size, Color, etc.)
- Browse products without typing a search query
- See dynamic facet counts that update based on selections
- Navigate paginated results (24 per page)

**Total files changed: 19**

---

## Frontend Components (Storefront)

### 1. `my-medusa-store-storefront/src/components/SearchBar.tsx`

**Role:** Main search modal component - orchestrates all search UI state and logic.

**What it does:**

- Manages state for query, results, filters, pagination
- Debounces search requests (350ms)
- Calls `semanticProductSearch()` when state changes
- Renders header, filters sidebar, results grid, pagination
- Handles keyboard navigation (Escape, Enter)
- Locks body scroll when modal is open

**Key state:**

```typescript
const [query, setQuery] = useState("");
const [results, setResults] = useState<SemanticSearchHit[]>([]);
const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
const [selectedOptions, setSelectedOptions] = useState<
  Record<string, string[]>
>({});
const [currentPage, setCurrentPage] = useState(1);
```

**Changes made:**

- Refactored from 1000+ lines to ~330 lines by extracting sub-components
- Added filter state management
- Added pagination logic
- Added "browse mode" (filter without query)

---

### 2. `my-medusa-store-storefront/src/components/search/index.ts`

**Role:** Barrel export file for clean imports.

**What it does:**

```typescript
// Allows this:
import { FiltersSidebar, Pagination, ProductCard } from "./search";

// Instead of:
import { FiltersSidebar } from "./search/FiltersSidebar";
import { Pagination } from "./search/Pagination";
```

---

### 3. `my-medusa-store-storefront/src/components/search/icons.tsx`

**Role:** SVG icon components used throughout the search UI.

**Exports:**

- `SearchIcon` - Magnifying glass
- `CloseIcon` - X mark
- `FilterIcon` - Filter lines
- `ChevronLeftIcon` / `ChevronRightIcon` - Pagination arrows

---

### 4. `my-medusa-store-storefront/src/components/search/FilterSection.tsx`

**Role:** Wrapper component for filter groups.

**What it does:**

- Displays section title (e.g., "Categories", "Brands")
- Shows option count badge when >6 options
- Adds bottom border separator

**Props:** `title`, `count?`, `children`

---

### 5. `my-medusa-store-storefront/src/components/search/FilterCheckbox.tsx`

**Role:** Checkbox component for desktop filter selection.

**What it does:**

- Renders a checkbox with label and count
- Highlights on hover
- Truncates long labels

**Props:** `label`, `count`, `checked`, `onChange`

**Used in:** `FiltersSidebar` for categories, brands, options

---

### 6. `my-medusa-store-storefront/src/components/search/FilterPill.tsx`

**Role:** Pill-shaped button for mobile filter selection.

**What it does:**

- Toggle button with selected/unselected states
- Selected: dark background, light text
- Unselected: light background, dark text

**Props:** `label`, `count`, `selected`, `onClick`

**Used in:** `MobileFilters` (touch-friendly alternative to checkboxes)

---

### 7. `my-medusa-store-storefront/src/components/search/FiltersSidebar.tsx`

**Role:** Desktop filter sidebar (left column).

**What it does:**

- Renders filter sections: Categories, Brands, Price, Options
- Each section scrollable with max-height
- Hidden on mobile (`hidden lg:block`)

**Props:** All facet data + selected values + toggle callbacks

---

### 8. `my-medusa-store-storefront/src/components/search/MobileFilters.tsx`

**Role:** Fullscreen filter modal for mobile devices.

**What it does:**

- Trigger button showing active filter count
- Fullscreen overlay with filter sections
- Uses `FilterPill` for touch-friendly selection
- "Show Results" button to close

**Props:** Same as `FiltersSidebar`

---

### 9. `my-medusa-store-storefront/src/components/search/Pagination.tsx`

**Role:** Page navigation controls.

**What it does:**

- Previous/Next buttons
- Smart page number display: `1 ... 4 5 6 ... 10`
- Highlights current page
- Disables buttons at boundaries

**Props:** `currentPage`, `totalPages`, `onPageChange`

---

### 10. `my-medusa-store-storefront/src/components/search/ProductCard.tsx`

**Role:** Individual product result card.

**What it does:**

- Displays thumbnail (with fallback)
- Shows title and subtitle (2-line clamp)
- Hover effect with image zoom
- Clickable to navigate to product

**Props:** `hit` (SemanticSearchHit), `onClick`

---

### 11. `my-medusa-store-storefront/src/lib/search.ts`

**Role:** Frontend API client for semantic search.

**What it does:**

- Defines TypeScript types for search (hits, facets, options)
- Exports `semanticProductSearch()` function
- Transforms camelCase → snake_case for API
- Handles errors and returns typed response

**Changes made:**

- Added facet types: `CategoryFacet`, `BrandFacet`, `OptionFacet`, `PriceRange`
- Added `SemanticSearchOptions` type with all filter params
- Extended function to accept filters, offset, includeFacets

---

## Backend API (Medusa Store)

### 12. `my-medusa-store/src/api/store/search/route.ts`

**Role:** HTTP endpoint handler for `POST /store/search`.

**What it does:**

- Validates and sanitizes all input parameters
- Parses filters (categories, brands, price, options)
- Calls `searchProductsWorkflow`
- Records metrics
- Returns JSON response with hits and facets

**Changes made:**

- Added parsing for: `offset`, `category_ids`, `brands`, `min_price`, `max_price`, `options`, `include_facets`
- Added browse mode: empty query uses `"*"` wildcard
- Added `facets` to response

---

## Workflow Layer

### 13. `my-medusa-store/src/workflows/search/search-products.ts`

**Role:** Workflow orchestration for search operation.

**What it does:**

- Coordinates embedding generation → index search → result hydration
- Passes parameters through the pipeline
- Returns combined result

**Changes made:**

- Added `offset`, `filters`, `include_facets` to workflow input
- Passes new params to `searchIndexStep`
- Returns `facets` in output

---

### 14. `my-medusa-store/src/workflows/search/steps/search-index.ts`

**Role:** Step that queries Elasticsearch.

**What it does:**

- Calls `ElasticsearchModuleService.semanticSearch()`
- Measures duration
- Returns hits, count, mode, duration, facets

**Changes made:**

- Added `offset`, `filters`, `includeFacets` to options
- Returns `facets` in output

---

### 15. `my-medusa-store/src/workflows/product-embedding/steps/get-product-data.ts`

**Role:** Extracts product data for embedding generation.

**What it does:**

- Fetches product with variants, options, categories, prices
- Builds embedded text (title + description + categories)
- Extracts metadata for filtering

**Changes made:**

- Now extracts: `brand`, `min_price`, `max_price`, `options` map
- Uses Query API to fetch variant prices
- Options stored as `{ "Storage": ["256 GB", "512 GB"], "Color": ["Black"] }`

---

## Elasticsearch Module

### 16. `my-medusa-store/src/modules/elasticsearch/services/search-engine.ts`

**Role:** Core search logic and in-memory filtering.

**What it does:**

- Queries Elasticsearch with BM25 + vector search
- Applies in-memory filters (category, brand, price, options)
- Builds cascading facets
- Handles pagination (offset/limit)

**Changes made (major):**

**In-memory filtering pipeline:**

```
filteredHits
  → categoryFilteredHits (step 1)
  → priceFilteredHits (step 2)
  → brandFilteredHits (step 3)
  → finalFilteredHits (step 4: options)
```

**Two-way cascading facets:**

- Categories built from brand-filtered hits
- Brands built from category-filtered hits
- Prevents dead-ends in either direction

**New helper methods:**

- `buildCategoryFacetsFromHits()`
- `buildBrandFacetsFromHits()`
- `buildPriceRangeFromHits()`
- `buildOptionFacetsFromHits()`

---

### 17. `my-medusa-store/src/modules/elasticsearch/types/index.ts`

**Role:** TypeScript type definitions for Elasticsearch module.

**Changes made:**

- Extended `SemanticSearchFilters` with: `category_ids`, `brands`, `min_price`, `max_price`, `options`
- Extended `SemanticSearchOptions` with: `offset`, `includeFacets`
- Added types: `CategoryFacet`, `BrandFacet`, `OptionFacet`, `PriceRange`, `SearchFacets`
- Added `facets` to `SemanticSearchResult`

---

## Seed Script

### 18. `my-medusa-store/src/scripts/products.ts`

**Role:** Creates sample products for testing.

**What it does:**

- Generates products with proper metadata structure
- Includes: brand, categories, options (Storage, Color), variant prices

**Purpose:** Ensures test data has all fields needed for filtering to work.

---

## Summary by Layer

| Layer             | Files | Purpose                                           |
| ----------------- | ----- | ------------------------------------------------- |
| **UI Components** | 10    | Render search modal, filters, results, pagination |
| **API Client**    | 1     | Frontend → Backend communication                  |
| **API Route**     | 1     | Request validation and response formatting        |
| **Workflow**      | 2     | Orchestrate search pipeline                       |
| **Elasticsearch** | 2     | Query ES, filter in-memory, build facets          |
| **Embedding**     | 1     | Extract product metadata for indexing             |
| **Seed Data**     | 1     | Create test products                              |
| **Docs**          | 1     | Technical documentation                           |

---

## Key Concepts Implemented

1. **Cascading Facets**: Filters update dynamically to prevent dead-ends
2. **Two-Way Cascading**: Categories ↔ Brands update each other
3. **Multi-Select**: OR within facet type, AND between types
4. **Browse Mode**: Filter without search query
5. **In-Memory Filtering**: ES fetches 500 docs, JS filters for flexibility
6. **Pagination**: Offset-based, 24 items per page
7. **Mobile-First**: Separate mobile filter UI with touch-friendly pills

## Workflow


┌──────────────────────────────────────────────────────────────┐
│  User clicks "Samsung" checkbox                              │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  toggleBrand("Samsung")                                      │
│  setSelectedBrands(["Samsung"])                              │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼ React state changes
┌──────────────────────────────────────────────────────────────┐
│  useEffect triggers (selectedBrands changed)                 │
│  semanticProductSearch({ brands: ["Samsung"], ... })         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼ API call
┌──────────────────────────────────────────────────────────────┐
│  Backend: search-engine.ts                                   │
│  1. Query Elasticsearch (500 products)                       │
│  2. Filter: keep only brand="Samsung" (42 products)          │
│  3. Build facets from filtered products                      │
│     - Categories: only those with Samsung products           │
│     - Options: only Samsung's sizes/colors                   │
│  4. Return { hits: [...], facets: {...} }                    │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼ Response
┌──────────────────────────────────────────────────────────────┐
│  setResults(response.hits)        → Product grid updates     │
│  setFacets(response.facets.categories) → Category list updates│
│  setOptionFacets(response.facets.options) → Options update   │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼ React re-render
┌──────────────────────────────────────────────────────────────┐
│  UI shows:                                                   │
│  ✓ 42 Samsung products                                       │
│  ✓ Categories now show counts for Samsung only               │
│  ✓ "Electronics (35)" instead of "Electronics (120)"         │
└──────────────────────────────────────────────────────────────┘