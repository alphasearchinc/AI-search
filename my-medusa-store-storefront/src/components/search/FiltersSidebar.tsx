// Filters Sidebar component (desktop)

import type {
  BrandFacet,
  CategoryFacet,
  OptionFacet,
  PriceRange,
} from "@lib/search"
import { FilterCheckbox } from "./FilterCheckbox"
import { FilterSection } from "./FilterSection"

interface FiltersSidebarProps {
  facets: CategoryFacet[]
  brandFacets: BrandFacet[]
  optionFacets: OptionFacet[]
  priceRange: PriceRange | null
  selectedCategories: string[]
  selectedBrands: string[]
  selectedOptions: Record<string, string[]>
  minPriceInput: string
  maxPriceInput: string
  onToggleCategory: (id: string) => void
  onToggleBrand: (brand: string) => void
  onToggleOption: (name: string, value: string) => void
  onMinPriceChange: (value: string) => void
  onMaxPriceChange: (value: string) => void
}

export const FiltersSidebar = ({
  facets,
  brandFacets,
  optionFacets,
  priceRange,
  selectedCategories,
  selectedBrands,
  selectedOptions,
  minPriceInput,
  maxPriceInput,
  onToggleCategory,
  onToggleBrand,
  onToggleOption,
  onMinPriceChange,
  onMaxPriceChange,
}: FiltersSidebarProps) => {
  return (
    <div
      data-testid="filters-sidebar"
      className="w-64 flex-shrink-0 hidden lg:block"
    >
      <div className="space-y-5">
        {/* Categories */}
        {facets.length > 0 && (
          <FilterSection title="Categories" count={facets.length}>
            <div
              data-testid="category-filters"
              className="space-y-1 max-h-52 overflow-y-auto pr-1"
            >
              {facets.map((cat) => (
                <FilterCheckbox
                  key={cat.id}
                  label={cat.name}
                  count={cat.count}
                  checked={selectedCategories.includes(cat.id)}
                  onChange={() => onToggleCategory(cat.id)}
                />
              ))}
            </div>
          </FilterSection>
        )}

        {/* Brands */}
        {brandFacets.length > 0 && (
          <FilterSection title="Brands" count={brandFacets.length}>
            <div
              data-testid="brand-filters"
              className="space-y-1 max-h-52 overflow-y-auto pr-1"
            >
              {brandFacets.map((brand) => (
                <FilterCheckbox
                  key={brand.name}
                  label={brand.name}
                  count={brand.count}
                  checked={selectedBrands.includes(brand.name)}
                  onChange={() => onToggleBrand(brand.name)}
                />
              ))}
            </div>
          </FilterSection>
        )}

        {/* Price Range */}
        <FilterSection title="Price">
          <div className="space-y-2">
            {priceRange && (
              <p className="text-xs text-ui-fg-subtle">
                Range: ${priceRange.min.toFixed(0)} - $
                {priceRange.max.toFixed(0)}
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={minPriceInput}
                onChange={(e) => onMinPriceChange(e.target.value)}
                data-testid="price-min"
                className="w-full px-2 py-1.5 text-sm border border-ui-border-base rounded-md bg-ui-bg-field text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:border-ui-fg-base"
                min={0}
              />
              <span className="text-ui-fg-muted">–</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPriceInput}
                onChange={(e) => onMaxPriceChange(e.target.value)}
                data-testid="price-max"
                className="w-full px-2 py-1.5 text-sm border border-ui-border-base rounded-md bg-ui-bg-field text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:border-ui-fg-base"
                min={0}
              />
            </div>
          </div>
        </FilterSection>

        {/* Options */}
        {optionFacets.map((option) => (
          <FilterSection
            key={option.name}
            title={option.name}
            count={option.values.length}
          >
            <div
              data-testid={`option-filter-${option.name}`}
              className="space-y-1 max-h-52 overflow-y-auto pr-1"
            >
              {option.values.map(({ value, count }) => (
                <FilterCheckbox
                  key={value}
                  label={value}
                  count={count}
                  checked={
                    selectedOptions[option.name]?.includes(value) ?? false
                  }
                  onChange={() => onToggleOption(option.name, value)}
                />
              ))}
            </div>
          </FilterSection>
        ))}
      </div>
    </div>
  )
}
