"use client"

import {
  semanticProductSearch,
  type BrandFacet,
  type CategoryFacet,
  type OptionFacet,
  type PriceRange,
  type SemanticSearchHit,
  type TagFacet,
} from "@lib/search"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import {
  CloseIcon,
  FiltersSidebar,
  MobileFilters,
  Pagination,
  ProductCard,
  SearchIcon,
} from "./search"

const RESULT_LIMIT = 24
const DEBOUNCE_DELAY = 350

const SearchBar = () => {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SemanticSearchHit[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [facets, setFacets] = useState<CategoryFacet[]>([])
  const [brandFacets, setBrandFacets] = useState<BrandFacet[]>([])
  const [tagFacets, setTagFacets] = useState<TagFacet[]>([])
  const [optionFacets, setOptionFacets] = useState<OptionFacet[]>([])
  const [priceRange, setPriceRange] = useState<PriceRange | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string[]>
  >({})
  const [minPriceInput, setMinPriceInput] = useState("")
  const [maxPriceInput, setMaxPriceInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const modalInputRef = useRef<HTMLInputElement | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const latestQueryRef = useRef("")

  // Pagination calculations
  const totalPages = Math.ceil(totalCount / RESULT_LIMIT)
  const offset = (currentPage - 1) * RESULT_LIMIT

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
    selectedTags.length +
    Object.values(selectedOptions).reduce((sum, arr) => sum + arr.length, 0) +
    (validMinPrice !== undefined ? 1 : 0) +
    (validMaxPrice !== undefined ? 1 : 0)

  // Close modal on route change
  useEffect(() => {
    setIsModalOpen(false)
  }, [pathname])

  // Detect Mac vs Windows/Linux for keyboard shortcut display
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0)
  }, [])

  // Global keyboard shortcut: Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      const isMacOS = navigator.platform.toUpperCase().indexOf("MAC") >= 0
      const isShortcut = isMacOS
        ? e.metaKey && e.key.toLowerCase() === "k"
        : e.ctrlKey && e.key.toLowerCase() === "k"

      if (isShortcut) {
        e.preventDefault()
        setIsModalOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown)
    return () => document.removeEventListener("keydown", handleGlobalKeyDown)
  }, [])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden"
      setTimeout(() => modalInputRef.current?.focus(), 50)
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isModalOpen])

  // Change document title when search modal is open
  useEffect(() => {
    if (isModalOpen) {
      const originalTitle = document.title
      document.title = "Tech Search"
      return () => {
        document.title = originalTitle
      }
    }
  }, [isModalOpen])

  // Search effect
  useEffect(() => {
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
          query: trimmedQuery,
          limit: RESULT_LIMIT,
          offset,
          categoryIds:
            selectedCategories.length > 0 ? selectedCategories : undefined,
          brands: selectedBrands.length > 0 ? selectedBrands : undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          minPrice: validMinPrice,
          maxPrice: validMaxPrice,
          options:
            Object.keys(activeOptions).length > 0 ? activeOptions : undefined,
          includeFacets: true, // Always include facets to support cascading
        })
        if (latestQueryRef.current === trimmedQuery) {
          setResults(response.hits)
          // Always update facets to reflect current filter state
          setTotalCount(response.total)
          setFacets(response.facets?.categories ?? [])
          setBrandFacets(response.facets?.brands ?? [])
          setTagFacets(response.facets?.tags ?? [])
          setOptionFacets(response.facets?.options ?? [])
          setPriceRange(response.facets?.priceRange ?? null)
        }
      } catch (err: unknown) {
        if (latestQueryRef.current === trimmedQuery) {
          const message =
            err instanceof Error ? err.message : "Unable to search right now"
          setResults([])
          setTotalCount(0)
          setFacets([])
          setBrandFacets([])
          setTagFacets([])
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
    currentPage,
    offset,
    selectedCategories,
    selectedBrands,
    selectedTags,
    selectedOptions,
    validMinPrice,
    validMaxPrice,
  ])

  // Reset to page 1 when filters or query change
  useEffect(() => {
    setCurrentPage(1)
  }, [
    trimmedQuery,
    selectedCategories,
    selectedBrands,
    selectedTags,
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
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setQuery("")
    setResults([])
    setTotalCount(0)
    setCurrentPage(1)
    setFacets([])
    setBrandFacets([])
    setTagFacets([])
    setOptionFacets([])
    setPriceRange(null)
    setSelectedCategories([])
    setSelectedBrands([])
    setSelectedTags([])
    setSelectedOptions({})
    setMinPriceInput("")
    setMaxPriceInput("")
    setError(null)
    setIsLoading(false)
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setSelectedBrands([])
    setSelectedTags([])
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

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
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
        data-testid="search-trigger"
        className="flex items-center gap-2 rounded-full border border-ui-border-base bg-ui-bg-field px-4 py-2 shadow-elevation-card-rest hover:shadow-elevation-card-hover hover:border-ui-fg-base transition-all w-full max-w-md"
      >
        <SearchIcon />
        <span className="text-ui-fg-muted text-sm">Search products...</span>
        <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 rounded border border-ui-border-base bg-ui-bg-subtle px-1.5 py-0.5 text-[10px] text-ui-fg-muted">
          <span className="text-xs">{isMac ? "⌘" : "Ctrl"}</span>K
        </kbd>
      </button>

      {/* Fullscreen Modal */}
      {isModalOpen && (
        <div
          data-testid="search-modal"
          className="fixed inset-0 z-50 bg-ui-bg-base flex flex-col overflow-hidden"
        >
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
                      data-testid="search-input"
                      className="flex-1 bg-transparent text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none text-base"
                      autoComplete="off"
                    />
                    {isLoading && (
                      <div
                        data-testid="search-loading"
                        className="animate-spin h-4 w-4 border-2 border-ui-fg-muted border-t-transparent rounded-full"
                      />
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
                  data-testid="search-close"
                  className="flex items-center justify-center w-10 h-10 rounded-lg border border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover text-ui-fg-base transition-colors"
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              {/* Active Filters Summary */}
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2 pb-3">
                  <span
                    data-testid="active-filter-count"
                    className="text-xs text-ui-fg-muted"
                  >
                    {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}{" "}
                    active
                  </span>
                  <button
                    type="button"
                    onClick={clearFilters}
                    data-testid="clear-filters"
                    className="text-xs text-ui-fg-interactive hover:text-ui-fg-interactive-hover underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {error ? (
                <div className="text-center py-16">
                  <p className="text-rose-600">{error}</p>
                </div>
              ) : (
                <div className="flex gap-8">
                  {/* Filters Sidebar (Desktop) */}
                  <FiltersSidebar
                    facets={facets}
                    brandFacets={brandFacets}
                    tagFacets={tagFacets}
                    optionFacets={optionFacets}
                    priceRange={priceRange}
                    selectedCategories={selectedCategories}
                    selectedBrands={selectedBrands}
                    selectedTags={selectedTags}
                    selectedOptions={selectedOptions}
                    minPriceInput={minPriceInput}
                    maxPriceInput={maxPriceInput}
                    onToggleCategory={toggleCategory}
                    onToggleBrand={toggleBrand}
                    onToggleTag={toggleTag}
                    onToggleOption={toggleOption}
                    onMinPriceChange={setMinPriceInput}
                    onMaxPriceChange={setMaxPriceInput}
                  />

                  {/* Results Grid */}
                  <div className="flex-1 min-w-0">
                    {/* Mobile Filters */}
                    <div className="lg:hidden mb-4">
                      <MobileFilters
                        facets={facets}
                        brandFacets={brandFacets}
                        tagFacets={tagFacets}
                        optionFacets={optionFacets}
                        priceRange={priceRange}
                        selectedCategories={selectedCategories}
                        selectedBrands={selectedBrands}
                        selectedTags={selectedTags}
                        selectedOptions={selectedOptions}
                        minPriceInput={minPriceInput}
                        maxPriceInput={maxPriceInput}
                        onToggleCategory={toggleCategory}
                        onToggleBrand={toggleBrand}
                        onToggleTag={toggleTag}
                        onToggleOption={toggleOption}
                        onMinPriceChange={setMinPriceInput}
                        onMaxPriceChange={setMaxPriceInput}
                      />
                    </div>

                    {/* Results Count */}
                    <div className="mb-4 flex items-center justify-between">
                      <p
                        data-testid="result-count"
                        className="text-sm text-ui-fg-muted"
                      >
                        {isLoading
                          ? "Searching..."
                          : totalCount > 0
                          ? `Showing ${offset + 1}-${Math.min(
                              offset + results.length,
                              totalCount
                            )} of ${totalCount} results`
                          : "0 results found"}
                      </p>
                      {totalPages > 1 && (
                        <p className="text-sm text-ui-fg-muted">
                          Page {currentPage} of {totalPages}
                        </p>
                      )}
                    </div>

                    {/* Results */}
                    {results.length > 0 ? (
                      <>
                        <div
                          data-testid="search-results"
                          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                        >
                          {results.map((hit) => (
                            <ProductCard
                              key={hit.id}
                              hit={hit}
                              onClick={() => handleResultNavigation(hit)}
                            />
                          ))}
                        </div>

                        {totalPages > 1 && (
                          <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                          />
                        )}
                      </>
                    ) : (
                      !isLoading && (
                        <div
                          data-testid="no-results"
                          className="text-center py-16"
                        >
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

export default SearchBar
