"use client"

import { useState } from "react"
import type {
  BrandFacet,
  CategoryFacet,
  OptionFacet,
  PriceRange,
  TagFacet,
} from "@lib/search"
import { CloseIcon, FilterIcon } from "./icons"
import { FilterPill } from "./FilterPill"
import { FilterSection } from "./FilterSection"

interface MobileFiltersProps {
  facets: CategoryFacet[]
  brandFacets: BrandFacet[]
  tagFacets: TagFacet[]
  optionFacets: OptionFacet[]
  priceRange: PriceRange | null
  selectedCategories: string[]
  selectedBrands: string[]
  selectedTags: string[]
  selectedOptions: Record<string, string[]>
  minPriceInput: string
  maxPriceInput: string
  onToggleCategory: (id: string) => void
  onToggleBrand: (brand: string) => void
  onToggleTag: (tag: string) => void
  onToggleOption: (name: string, value: string) => void
  onMinPriceChange: (value: string) => void
  onMaxPriceChange: (value: string) => void
}

export const MobileFilters = ({
  facets,
  brandFacets,
  tagFacets,
  optionFacets,
  priceRange,
  selectedCategories,
  selectedBrands,
  selectedTags,
  selectedOptions,
  minPriceInput,
  maxPriceInput,
  onToggleCategory,
  onToggleBrand,
  onToggleTag,
  onToggleOption,
  onMinPriceChange,
  onMaxPriceChange,
}: MobileFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const hasFilters =
    facets.length > 0 ||
    brandFacets.length > 0 ||
    tagFacets.length > 0 ||
    optionFacets.length > 0 ||
    priceRange

  if (!hasFilters) return null

  const activeFilterCount =
    selectedCategories.length +
    selectedBrands.length +
    selectedTags.length +
    Object.values(selectedOptions).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        data-testid="mobile-filter-button"
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle text-sm text-ui-fg-base"
      >
        <FilterIcon />
        Filters
        {activeFilterCount > 0 && (
          <span className="bg-ui-fg-base text-ui-bg-base text-xs px-1.5 py-0.5 rounded-full">
            {activeFilterCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          data-testid="mobile-filter-drawer"
          className="fixed inset-0 z-50 bg-ui-bg-base"
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-ui-border-base">
            <h2 className="text-lg font-medium">Filters</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-2"
            >
              <CloseIcon size={20} />
            </button>
          </div>

          <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-8rem)]">
            {/* Categories */}
            {facets.length > 0 && (
              <FilterSection title="Categories">
                <div className="flex flex-wrap gap-2">
                  {facets.map((cat) => (
                    <FilterPill
                      key={cat.id}
                      label={cat.name}
                      count={cat.count}
                      selected={selectedCategories.includes(cat.id)}
                      onClick={() => onToggleCategory(cat.id)}
                    />
                  ))}
                </div>
              </FilterSection>
            )}

            {/* Brands */}
            {brandFacets.length > 0 && (
              <FilterSection title="Brands">
                <div className="flex flex-wrap gap-2">
                  {brandFacets.map((brand) => (
                    <FilterPill
                      key={brand.name}
                      label={brand.name}
                      count={brand.count}
                      selected={selectedBrands.includes(brand.name)}
                      onClick={() => onToggleBrand(brand.name)}
                    />
                  ))}
                </div>
              </FilterSection>
            )}

            {/* Tags */}
            {tagFacets.length > 0 && (
              <FilterSection title="Tags">
                <div className="flex flex-wrap gap-2">
                  {tagFacets.map((tag) => (
                    <FilterPill
                      key={tag.value}
                      label={tag.value}
                      count={tag.count}
                      selected={selectedTags.includes(tag.value)}
                      onClick={() => onToggleTag(tag.value)}
                    />
                  ))}
                </div>
              </FilterSection>
            )}

            {/* Price */}
            <FilterSection title="Price">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPriceInput}
                  onChange={(e) => onMinPriceChange(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-ui-border-base rounded-md bg-ui-bg-field"
                  min={0}
                />
                <span className="text-ui-fg-muted">–</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPriceInput}
                  onChange={(e) => onMaxPriceChange(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-ui-border-base rounded-md bg-ui-bg-field"
                  min={0}
                />
              </div>
            </FilterSection>

            {/* Options */}
            {optionFacets.map((option) => (
              <FilterSection key={option.name} title={option.name}>
                <div className="flex flex-wrap gap-2">
                  {option.values.map(({ value, count }) => (
                    <FilterPill
                      key={value}
                      label={value}
                      count={count}
                      selected={
                        selectedOptions[option.name]?.includes(value) ?? false
                      }
                      onClick={() => onToggleOption(option.name, value)}
                    />
                  ))}
                </div>
              </FilterSection>
            ))}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-ui-border-base bg-ui-bg-base">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              data-testid="mobile-apply-filters"
              className="w-full py-3 bg-ui-fg-base text-ui-bg-base rounded-lg font-medium"
            >
              Show Results
            </button>
          </div>
        </div>
      )}
    </>
  )
}
