"use client"

import {
  semanticProductSearch,
  type BrandFacet,
  type CategoryFacet,
  type OptionFacet,
  type PriceRange,
  type SemanticSearchHit,
} from "@lib/search"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"

const RESULT_LIMIT = 12
const DEBOUNCE_DELAY = 350

const SearchBar = () => {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SemanticSearchHit[]>([])
  const [facets, setFacets] = useState<CategoryFacet[]>([])
  const [brandFacets, setBrandFacets] = useState<BrandFacet[]>([])
  const [optionFacets, setOptionFacets] = useState<OptionFacet[]>([])
  const [priceRange, setPriceRange] = useState<PriceRange | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string[]>
  >({})
  const [minPriceInput, setMinPriceInput] = useState("")
  const [maxPriceInput, setMaxPriceInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const modalInputRef = useRef<HTMLInputElement | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const latestQueryRef = useRef("")

  // Parse price inputs to numbers
  const minPrice = minPriceInput ? parseFloat(minPriceInput) : undefined
  const maxPrice = maxPriceInput ? parseFloat(maxPriceInput) : undefined
  const validMinPrice =
    minPrice !== undefined && !isNaN(minPrice) ? minPrice : undefined
  const validMaxPrice =
    maxPrice !== undefined && !isNaN(maxPrice) ? maxPrice : undefined

  const trimmedQuery = query.trim()

  // Count active filters
  const activeFilterCount =
    selectedCategories.length +
    selectedBrands.length +
    Object.values(selectedOptions).reduce((sum, arr) => sum + arr.length, 0) +
    (validMinPrice !== undefined ? 1 : 0) +
    (validMaxPrice !== undefined ? 1 : 0)

  // Close modal on route change
  useEffect(() => {
    setIsModalOpen(false)
  }, [pathname])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden"
      // Focus input when modal opens
      setTimeout(() => modalInputRef.current?.focus(), 50)
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isModalOpen])

  // Search effect - triggers on modal open, query change, or filter change
  useEffect(() => {
    // Don't search if modal is closed
    if (!isModalOpen) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    setIsLoading(true)
    setError(null)

    debounceRef.current = setTimeout(async () => {
      latestQueryRef.current = trimmedQuery
      try {
        const activeOptions = Object.fromEntries(
          Object.entries(selectedOptions).filter(
            ([, values]) => values.length > 0
          )
        )

        const response = await semanticProductSearch({
          query: trimmedQuery, // Can be empty - backend will use "*" for browse mode
          limit: RESULT_LIMIT,
          categoryIds:
            selectedCategories.length > 0 ? selectedCategories : undefined,
          brands: selectedBrands.length > 0 ? selectedBrands : undefined,
          minPrice: validMinPrice,
          maxPrice: validMaxPrice,
          options:
            Object.keys(activeOptions).length > 0 ? activeOptions : undefined,
          includeFacets: true,
        })
        if (latestQueryRef.current === trimmedQuery) {
          setResults(response.hits)
          setFacets(response.facets?.categories ?? [])
          setBrandFacets(response.facets?.brands ?? [])
          setOptionFacets(response.facets?.options ?? [])
          setPriceRange(response.facets?.priceRange ?? null)
        }
      } catch (err: unknown) {
        if (latestQueryRef.current === trimmedQuery) {
          const message =
            err instanceof Error ? err.message : "Unable to search right now"
          setResults([])
          setFacets([])
          setBrandFacets([])
          setOptionFacets([])
          setPriceRange(null)
          setError(message)
        }
      } finally {
        if (latestQueryRef.current === trimmedQuery) {
          setIsLoading(false)
        }
      }
    }, DEBOUNCE_DELAY)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [
    isModalOpen,
    trimmedQuery,
    selectedCategories,
    selectedBrands,
    selectedOptions,
    validMinPrice,
    validMaxPrice,
  ])

  const handleResultNavigation = (hit: SemanticSearchHit) => {
    const handle = hit.product.handle
    if (!handle) return

    const segments = pathname?.split("/").filter(Boolean) ?? []
    const countryCode =
      segments[0] && segments[0].length === 2 ? segments[0] : ""
    const destination = countryCode
      ? `/${countryCode}/products/${handle}`
      : `/products/${handle}`

    router.push(destination)
    closeModal()
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setQuery("")
    setResults([])
    setFacets([])
    setBrandFacets([])
    setOptionFacets([])
    setPriceRange(null)
    setSelectedCategories([])
    setSelectedBrands([])
    setSelectedOptions({})
    setMinPriceInput("")
    setMaxPriceInput("")
    setError(null)
    setIsLoading(false)
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setSelectedBrands([])
    setSelectedOptions({})
    setMinPriceInput("")
    setMaxPriceInput("")
  }

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    )
  }

  const toggleOption = (optionName: string, value: string) => {
    setSelectedOptions((prev) => {
      const currentValues = prev[optionName] ?? []
      const isSelected = currentValues.includes(value)

      if (isSelected) {
        const newValues = currentValues.filter((v) => v !== value)
        if (newValues.length === 0) {
          const { [optionName]: _, ...rest } = prev
          return rest
        }
        return { ...prev, [optionName]: newValues }
      } else {
        return { ...prev, [optionName]: [...currentValues, value] }
      }
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      closeModal()
      return
    }
    if (event.key === "Enter" && results.length && trimmedQuery.length) {
      handleResultNavigation(results[0])
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 rounded-full border border-ui-border-base bg-ui-bg-field px-4 py-2 shadow-elevation-card-rest hover:shadow-elevation-card-hover hover:border-ui-fg-base transition-all w-full max-w-md"
      >
        <SearchIcon />
        <span className="text-ui-fg-muted text-sm">Search products...</span>
        <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 rounded border border-ui-border-base bg-ui-bg-subtle px-1.5 py-0.5 text-[10px] text-ui-fg-muted">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Fullscreen Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-ui-bg-base flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 bg-ui-bg-base border-b border-ui-border-base">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-4 py-4">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <div className="flex items-center gap-3 rounded-lg border border-ui-border-base bg-ui-bg-field px-4 py-3 focus-within:border-ui-fg-base transition-colors">
                    <SearchIcon />
                    <input
                      ref={modalInputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Search for products..."
                      className="flex-1 bg-transparent text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none text-base"
                      autoComplete="off"
                    />
                    {isLoading && (
                      <div className="animate-spin h-4 w-4 border-2 border-ui-fg-muted border-t-transparent rounded-full" />
                    )}
                    {query && !isLoading && (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="text-ui-fg-muted hover:text-ui-fg-base p-1"
                      >
                        <CloseIcon size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex items-center justify-center w-10 h-10 rounded-lg border border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover text-ui-fg-base transition-colors"
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              {/* Active Filters Summary */}
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2 pb-3">
                  <span className="text-xs text-ui-fg-muted">
                    {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}{" "}
                    active
                  </span>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs text-ui-fg-interactive hover:text-ui-fg-interactive-hover underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {error ? (
                <div className="text-center py-16">
                  <p className="text-rose-600">{error}</p>
                </div>
              ) : (
                <div className="flex gap-8">
                  {/* Filters Sidebar */}
                  <div className="w-64 flex-shrink-0 hidden lg:block">
                    <div className="space-y-5">
                      {/* Categories */}
                      {facets.length > 0 && (
                        <FilterSection title="Categories" count={facets.length}>
                          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                            {facets.map((cat) => (
                              <FilterCheckbox
                                key={cat.id}
                                label={cat.name}
                                count={cat.count}
                                checked={selectedCategories.includes(cat.id)}
                                onChange={() => toggleCategory(cat.id)}
                              />
                            ))}
                          </div>
                        </FilterSection>
                      )}

                      {/* Brands */}
                      {brandFacets.length > 0 && (
                        <FilterSection
                          title="Brands"
                          count={brandFacets.length}
                        >
                          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                            {brandFacets.map((brand) => (
                              <FilterCheckbox
                                key={brand.name}
                                label={brand.name}
                                count={brand.count}
                                checked={selectedBrands.includes(brand.name)}
                                onChange={() => toggleBrand(brand.name)}
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
                              onChange={(e) => setMinPriceInput(e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-ui-border-base rounded-md bg-ui-bg-field text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:border-ui-fg-base"
                              min={0}
                            />
                            <span className="text-ui-fg-muted">–</span>
                            <input
                              type="number"
                              placeholder="Max"
                              value={maxPriceInput}
                              onChange={(e) => setMaxPriceInput(e.target.value)}
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
                          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                            {option.values.map(({ value, count }) => (
                              <FilterCheckbox
                                key={value}
                                label={value}
                                count={count}
                                checked={
                                  selectedOptions[option.name]?.includes(
                                    value
                                  ) ?? false
                                }
                                onChange={() =>
                                  toggleOption(option.name, value)
                                }
                              />
                            ))}
                          </div>
                        </FilterSection>
                      ))}
                    </div>
                  </div>

                  {/* Results Grid */}
                  <div className="flex-1 min-w-0">
                    {/* Mobile Filters */}
                    <div className="lg:hidden mb-4">
                      <MobileFilters
                        facets={facets}
                        brandFacets={brandFacets}
                        optionFacets={optionFacets}
                        priceRange={priceRange}
                        selectedCategories={selectedCategories}
                        selectedBrands={selectedBrands}
                        selectedOptions={selectedOptions}
                        minPriceInput={minPriceInput}
                        maxPriceInput={maxPriceInput}
                        onToggleCategory={toggleCategory}
                        onToggleBrand={toggleBrand}
                        onToggleOption={toggleOption}
                        onMinPriceChange={setMinPriceInput}
                        onMaxPriceChange={setMaxPriceInput}
                      />
                    </div>

                    {/* Results Count */}
                    <div className="mb-4">
                      <p className="text-sm text-ui-fg-muted">
                        {isLoading
                          ? "Searching..."
                          : `${results.length} result${
                              results.length !== 1 ? "s" : ""
                            } found`}
                      </p>
                    </div>

                    {/* Results */}
                    {results.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {results.map((hit) => (
                          <ProductCard
                            key={hit.id}
                            hit={hit}
                            onClick={() => handleResultNavigation(hit)}
                          />
                        ))}
                      </div>
                    ) : (
                      !isLoading && (
                        <div className="text-center py-16">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ui-bg-subtle mb-4">
                            <SearchIcon size={32} />
                          </div>
                          <p className="text-ui-fg-muted text-lg">
                            No products found
                          </p>
                          <p className="text-ui-fg-subtle text-sm mt-1">
                            Try adjusting your search or filters
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Filter Section Component
const FilterSection = ({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) => (
  <div className="border-b border-ui-border-base pb-5 last:border-b-0">
    <h3 className="text-sm font-medium text-ui-fg-base mb-3 flex items-center justify-between">
      <span>{title}</span>
      {count !== undefined && count > 6 && (
        <span className="text-xs text-ui-fg-muted font-normal">
          {count} options
        </span>
      )}
    </h3>
    {children}
  </div>
)

// Filter Checkbox Component
const FilterCheckbox = ({
  label,
  count,
  checked,
  onChange,
}: {
  label: string
  count: number
  checked: boolean
  onChange: () => void
}) => (
  <label className="flex items-center gap-2 py-1 cursor-pointer group">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 rounded border-ui-border-base text-ui-fg-base focus:ring-ui-fg-base focus:ring-offset-0"
    />
    <span className="flex-1 text-sm text-ui-fg-base group-hover:text-ui-fg-base/80 truncate">
      {label}
    </span>
    <span className="text-xs text-ui-fg-muted">{count}</span>
  </label>
)

// Product Card Component
const ProductCard = ({
  hit,
  onClick,
}: {
  hit: SemanticSearchHit
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className="group text-left bg-ui-bg-subtle rounded-lg p-4 hover:bg-ui-bg-subtle-hover transition-colors"
  >
    {/* Thumbnail */}
    <div className="aspect-square w-full overflow-hidden rounded-md bg-ui-bg-base mb-3">
      {hit.product.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hit.product.thumbnail}
          alt={hit.product.title ?? "Product"}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-ui-fg-muted">
          <span className="text-sm">No image</span>
        </div>
      )}
    </div>

    {/* Info */}
    <h4 className="text-sm font-medium text-ui-fg-base line-clamp-2 mb-1">
      {hit.product.title ?? "Untitled"}
    </h4>
    <p className="text-xs text-ui-fg-subtle line-clamp-2">
      {hit.product.subtitle || hit.product.description || "View product"}
    </p>
  </button>
)

// Mobile Filters Component
const MobileFilters = ({
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
}: {
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
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const hasFilters =
    facets.length > 0 ||
    brandFacets.length > 0 ||
    optionFacets.length > 0 ||
    priceRange

  if (!hasFilters) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle text-sm text-ui-fg-base"
      >
        <FilterIcon />
        Filters
        {(selectedCategories.length > 0 ||
          selectedBrands.length > 0 ||
          Object.keys(selectedOptions).length > 0) && (
          <span className="bg-ui-fg-base text-ui-bg-base text-xs px-1.5 py-0.5 rounded-full">
            {selectedCategories.length +
              selectedBrands.length +
              Object.values(selectedOptions).reduce(
                (sum, arr) => sum + arr.length,
                0
              )}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-ui-bg-base">
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

// Filter Pill Component (for mobile)
const FilterPill = ({
  label,
  count,
  selected,
  onClick,
}: {
  label: string
  count: number
  selected: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
      selected
        ? "bg-ui-fg-base text-ui-bg-base"
        : "bg-ui-bg-subtle text-ui-fg-base hover:bg-ui-bg-subtle-hover"
    }`}
  >
    {label}
    <span className={selected ? "text-ui-bg-base/70" : "text-ui-fg-muted"}>
      ({count})
    </span>
  </button>
)

// Icons
const SearchIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="text-ui-fg-muted flex-shrink-0"
  >
    <path
      d="M21 21L16.65 16.65M11 6C13.7614 6 16 8.23858 16 11M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CloseIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="text-current"
  >
    <path
      d="M18 6L6 18M6 6L18 18"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const FilterIcon = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="text-current"
  >
    <path
      d="M3 6H21M7 12H17M11 18H13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default SearchBar
