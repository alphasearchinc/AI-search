# Search Filters & Faceted Navigation

This document explains the implementation of the search filters and faceted navigation system in our storefront.

## Overview

The search modal provides a fullscreen search experience with:

- **Semantic search** (AI-powered, understands meaning)
- **Faceted filters** (categories, brands, options, price range)
- **Pagination** (24 products per page)
- **Cascading facets** (filters update based on selections to prevent dead-ends)

## Architecture

### Frontend Components

The search UI is split into modular components under `src/components/search/`:

```
src/components/
├── SearchBar.tsx          # Main component with state & logic (~330 lines)
└── search/
    ├── index.ts           # Barrel export
    ├── icons.tsx          # SVG icons (Search, Close, Filter, Chevrons)
    ├── FilterSection.tsx  # Section wrapper with title
    ├── FilterCheckbox.tsx # Checkbox for desktop filters
    ├── FilterPill.tsx     # Pill button for mobile filters
    ├── FiltersSidebar.tsx # Desktop filters sidebar
    ├── MobileFilters.tsx  # Mobile filters modal
    ├── Pagination.tsx     # Page navigation controls
    └── ProductCard.tsx    # Product result card
```

### Backend Search Engine

The search logic lives in `my-medusa-store/src/modules/elasticsearch/services/search-engine.ts`.

## Cascading Facets (Two-Way)

The key feature is **two-way cascading** - filters update in both directions to prevent dead-ends:

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                      All Products (500)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
          ┌─────────────────┐   ┌─────────────────┐
          │ Category Filter │   │  Brand Filter   │
          └─────────────────┘   └─────────────────┘
                    │                   │
                    ▼                   ▼
          ┌─────────────────┐   ┌─────────────────┐
          │ categoryFiltered│   │ brandFiltered   │
          │     Hits        │   │    (subset)     │
          └─────────────────┘   └─────────────────┘
                    │                   │
                    │    ┌──────────────┘
                    ▼    ▼
          ┌─────────────────────────────┐
          │   Brand + Category Filtered │
          │         (final results)     │
          └─────────────────────────────┘
```

### Facet Building Strategy

| Facet Type      | Built From                | Why                                     |
| --------------- | ------------------------- | --------------------------------------- |
| **Categories**  | Brand-filtered hits       | So selecting a brand narrows categories |
| **Brands**      | Category-filtered hits    | So selecting a category narrows brands  |
| **Options**     | Category + Brand filtered | Reflects both selections                |
| **Price Range** | Category + Brand filtered | Reflects both selections                |

### Example Flow

1. **User opens search** → All facets show full counts
2. **User selects "Samsung" brand** →
   - Categories update to show only categories with Samsung products
   - Options update to show only Samsung's sizes/colors
   - Price range updates to Samsung's price range
3. **User selects "Electronics" category** →
   - Brands update (Samsung still shown, plus other electronics brands)
   - Options further narrow to Samsung Electronics options
4. **No dead-ends** - User can always deselect to broaden results

## Multi-Select Within Facets

Users can select multiple values within the same facet type:

- **Multiple brands**: Samsung + Apple → Shows products from both
- **Multiple categories**: Electronics + Accessories → Shows products in either
- **Multiple options**: Size S + Size M → Shows products available in either size

### Backend Logic (OR within, AND between)

```typescript
// Brands: OR logic (product matches ANY selected brand)
if (brandsFilter.length > 0) {
  brandFilteredHits = hits.filter((hit) => {
    return brandsFilter.includes(hit.metadata?.brand);
  });
}

// Options: AND between types, OR within type
// e.g., (Size S OR Size M) AND (Color Red OR Color Blue)
for (const [optionName, selectedValues] of Object.entries(optionsFilter)) {
  const productValues = hit.metadata?.options[optionName] ?? [];
  const hasMatch = selectedValues.some((val) => productValues.includes(val));
  if (!hasMatch) return false; // Must match at least one value per option type
}
```

## Pagination

- **24 products per page** (`RESULT_LIMIT = 24`)
- **Offset-based**: `offset = (currentPage - 1) * RESULT_LIMIT`
- **Facets fetched on page 1 only** (performance optimization)
- **Total count preserved** across pages

### Backend Fetch Size

When filters are applied, the backend fetches 500 documents to ensure enough results after in-memory filtering:

```typescript
const hasInMemoryFilters =
  categoryIds.length > 0 ||
  brandsFilter.length > 0 ||
  minPrice !== undefined ||
  maxPrice !== undefined ||
  Object.keys(optionsFilter).length > 0;

const facetFetchSize =
  options.includeFacets || hasInMemoryFilters
    ? 500
    : Math.max(requestedOffset + size, size * overfetchMultiplier);
```

## API Contract

### Request (Frontend → Backend)

```typescript
interface SemanticSearchOptions {
  query: string; // Search text (empty = browse mode)
  limit?: number; // Results per page (default: 24)
  offset?: number; // Pagination offset
  categoryIds?: string[]; // Selected category IDs
  brands?: string[]; // Selected brand names
  minPrice?: number; // Minimum price filter
  maxPrice?: number; // Maximum price filter
  options?: Record<string, string[]>; // Option filters (e.g., { Size: ["S", "M"] })
  includeFacets?: boolean; // Whether to return facet data
}
```

### Response (Backend → Frontend)

```typescript
interface SemanticSearchResponse {
  hits: SemanticSearchHit[]; // Product results
  total: number; // Total count (for pagination)
  facets?: {
    categories: CategoryFacet[]; // { id, name, count }
    brands: BrandFacet[]; // { name, count }
    options: OptionFacet[]; // { name, values: [{ value, count }] }
    priceRange?: PriceRange; // { min, max }
  };
}
```

## Filter Order (Backend)

The order filters are applied matters for proper cascading:

1. **Category filter** → `categoryFilteredHits`
2. **Price filter** → `priceFilteredHits`
3. **Brand filter** → `brandFilteredHits`
4. **Options filter** → `finalFilteredHits`

Facets are built from intermediate stages to enable two-way cascading.

## Browse Mode (No Query)

Users can filter without typing a search query:

- Frontend sends empty `query: ""`
- Backend interprets as `"*"` (match all)
- All products shown, filterable by facets

## Performance Considerations

1. **Facets only on page 1**: `includeFacets: currentPage === 1`
2. **Debounced search**: 350ms delay before API call
3. **In-memory filtering**: Category/brand/option filters applied in JS, not Elasticsearch
4. **Fetch size**: 500 docs when filters active, otherwise `offset + limit`

## Component Props Reference

### FiltersSidebar / MobileFilters

```typescript
interface FiltersProps {
  facets: CategoryFacet[];
  brandFacets: BrandFacet[];
  optionFacets: OptionFacet[];
  priceRange: PriceRange | null;
  selectedCategories: string[];
  selectedBrands: string[];
  selectedOptions: Record<string, string[]>;
  minPriceInput: string;
  maxPriceInput: string;
  onToggleCategory: (id: string) => void;
  onToggleBrand: (brand: string) => void;
  onToggleOption: (name: string, value: string) => void;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
}
```

## Testing Checklist

- [ ] Search with query returns relevant results
- [ ] Empty search (browse mode) shows all products
- [ ] Selecting category narrows brands
- [ ] Selecting brand narrows categories
- [ ] Multi-select within brands works (OR logic)
- [ ] Multi-select within options works
- [ ] Price range filter works
- [ ] Pagination works with filters applied
- [ ] "Clear all" resets filters
- [ ] Mobile filters work correctly
- [ ] No dead-ends possible

## Related Files

- `my-medusa-store-storefront/src/components/SearchBar.tsx` - Main component
- `my-medusa-store-storefront/src/components/search/` - Sub-components
- `my-medusa-store-storefront/src/lib/search.ts` - API client
- `my-medusa-store/src/api/store/search/route.ts` - API endpoint
- `my-medusa-store/src/modules/elasticsearch/services/search-engine.ts` - Search logic
