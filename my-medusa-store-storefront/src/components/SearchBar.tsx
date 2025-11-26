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

const MIN_QUERY_LENGTH = 2
const RESULT_LIMIT = 6
const DEBOUNCE_DELAY = 350
const PRICE_DEBOUNCE_DELAY = 500

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
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const priceDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const latestQueryRef = useRef("")

  // Parse price inputs to numbers
  const minPrice = minPriceInput ? parseFloat(minPriceInput) : undefined
  const maxPrice = maxPriceInput ? parseFloat(maxPriceInput) : undefined
  const validMinPrice =
    minPrice !== undefined && !isNaN(minPrice) ? minPrice : undefined
  const validMaxPrice =
    maxPrice !== undefined && !isNaN(maxPrice) ? maxPrice : undefined

  const trimmedQuery = query.trim()
  const showDropdown =
    isOpen &&
    (trimmedQuery.length > 0 || isLoading || !!error || results.length > 0)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      setIsLoading(false)
      setError(null)
      setResults([])
      setFacets([])
      setBrandFacets([])
      setOptionFacets([])
      setPriceRange(null)
      return
    }

    setIsLoading(true)
    setError(null)

    debounceRef.current = setTimeout(async () => {
      latestQueryRef.current = trimmedQuery
      try {
        // Only include options with at least one selected value
        const activeOptions = Object.fromEntries(
          Object.entries(selectedOptions).filter(
            ([, values]) => values.length > 0
          )
        )

        const response = await semanticProductSearch({
          query: trimmedQuery,
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
      } catch (err: any) {
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
    trimmedQuery,
    selectedCategories,
    selectedBrands,
    selectedOptions,
    validMinPrice,
    validMaxPrice,
  ])

  const handleResultNavigation = (hit: SemanticSearchHit) => {
    const handle = hit.product.handle
    if (!handle) {
      return
    }

    const segments = pathname?.split("/").filter(Boolean) ?? []
    const countryCode =
      segments[0] && segments[0].length === 2 ? segments[0] : ""
    const destination = countryCode
      ? `/${countryCode}/products/${handle}`
      : `/products/${handle}`

    router.push(destination)
    setIsOpen(false)
    setQuery("")
    setResults([])
  }

  const handleClear = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    latestQueryRef.current = ""
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
    setIsOpen(true)
    inputRef.current?.focus()
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
          // Remove the option key entirely if no values selected
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
      setIsOpen(false)
      return
    }

    if (event.key === "Enter" && results.length && trimmedQuery.length) {
      handleResultNavigation(results[0])
    }
  }

  const handleBlur = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }

    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 120)
  }

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
    }
    setIsOpen(true)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <label htmlFor="header-search" className="sr-only">
        Search products
      </label>
      <div className="relative flex items-center gap-2 rounded-full border border-ui-border-base bg-ui-bg-field px-4 py-2 shadow-elevation-card-rest focus-within:border-ui-fg-base focus-within:shadow-elevation-card-hover transition-shadow">
        <SearchIcon />
        <div className="relative flex-1">
          <input
            id="header-search"
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setIsOpen(true)
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={handleFocus}
            placeholder="Search products"
            className="w-full bg-transparent text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none pr-24"
            autoComplete="off"
          />

          {isLoading && (
            <span className="pointer-events-none absolute right-6 top-1 text-xs text-ui-fg-muted">
              Searching…
            </span>
          )}

          {trimmedQuery.length > 0 && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleClear}
              className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-1 text-ui-fg-muted hover:text-ui-fg-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-fg-base/50"
              aria-label="Clear search"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          )}
        </div>
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 mt-2 rounded-large border border-ui-border-base bg-ui-bg-base shadow-elevation-card-rest z-50">
          {/* Category facets */}
          {facets.length > 0 && (
            <div className="px-4 py-3 border-b border-ui-border-base">
              <p className="text-xs text-ui-fg-muted mb-2">
                Filter by category
              </p>
              <div className="flex flex-wrap gap-2">
                {facets.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => toggleCategory(cat.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors ${
                        isSelected
                          ? "bg-ui-fg-base text-ui-bg-base"
                          : "bg-ui-bg-subtle text-ui-fg-base hover:bg-ui-bg-subtle-hover"
                      }`}
                    >
                      {cat.name}
                      <span
                        className={`${
                          isSelected ? "text-ui-bg-base/70" : "text-ui-fg-muted"
                        }`}
                      >
                        ({cat.count})
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Brand facets */}
          {brandFacets.length > 0 && (
            <div className="px-4 py-3 border-b border-ui-border-base">
              <p className="text-xs text-ui-fg-muted mb-2">Filter by brand</p>
              <div className="flex flex-wrap gap-2">
                {brandFacets.map((brand) => {
                  const isSelected = selectedBrands.includes(brand.name)
                  return (
                    <button
                      key={brand.name}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => toggleBrand(brand.name)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors ${
                        isSelected
                          ? "bg-ui-fg-base text-ui-bg-base"
                          : "bg-ui-bg-subtle text-ui-fg-base hover:bg-ui-bg-subtle-hover"
                      }`}
                    >
                      {brand.name}
                      <span
                        className={`${
                          isSelected ? "text-ui-bg-base/70" : "text-ui-fg-muted"
                        }`}
                      >
                        ({brand.count})
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Price range filter */}
          {trimmedQuery.length >= MIN_QUERY_LENGTH && (
            <div className="px-4 py-3 border-b border-ui-border-base">
              <p className="text-xs text-ui-fg-muted mb-2">
                Price range
                {priceRange && (
                  <span className="text-ui-fg-subtle ml-1">
                    (${priceRange.min.toFixed(0)} - ${priceRange.max.toFixed(0)}{" "}
                    available)
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPriceInput}
                  onChange={(e) => setMinPriceInput(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onFocus={handleFocus}
                  className="w-24 px-2 py-1 text-sm border border-ui-border-base rounded-md bg-ui-bg-field text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:border-ui-fg-base"
                  min={0}
                />
                <span className="text-ui-fg-muted text-sm">–</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPriceInput}
                  onChange={(e) => setMaxPriceInput(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onFocus={handleFocus}
                  className="w-24 px-2 py-1 text-sm border border-ui-border-base rounded-md bg-ui-bg-field text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:border-ui-fg-base"
                  min={0}
                />
                {(minPriceInput || maxPriceInput) && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setMinPriceInput("")
                      setMaxPriceInput("")
                    }}
                    className="text-xs text-ui-fg-muted hover:text-ui-fg-base"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Option facets (Storage, Color, etc.) */}
          {optionFacets.length > 0 && (
            <div className="px-4 py-3 border-b border-ui-border-base">
              <p className="text-xs text-ui-fg-muted mb-2">Filter by options</p>
              <div className="space-y-3">
                {optionFacets.map((option) => (
                  <div key={option.name}>
                    <p className="text-xs font-medium text-ui-fg-base mb-1.5">
                      {option.name}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {option.values.map(({ value, count }) => {
                        const isSelected =
                          selectedOptions[option.name]?.includes(value) ?? false
                        return (
                          <button
                            key={value}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => toggleOption(option.name, value)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                              isSelected
                                ? "bg-ui-fg-base text-ui-bg-base"
                                : "bg-ui-bg-subtle text-ui-fg-base hover:bg-ui-bg-subtle-hover"
                            }`}
                          >
                            {value}
                            <span
                              className={`${
                                isSelected
                                  ? "text-ui-bg-base/70"
                                  : "text-ui-fg-muted"
                              }`}
                            >
                              ({count})
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto py-2">
            {error && (
              <p className="px-4 py-3 text-sm text-rose-600">{error}</p>
            )}

            {!error &&
              trimmedQuery.length > 0 &&
              trimmedQuery.length < MIN_QUERY_LENGTH && (
                <p className="px-4 py-3 text-sm text-ui-fg-muted">
                  Type at least {MIN_QUERY_LENGTH} characters to search
                </p>
              )}

            {!error &&
              trimmedQuery.length >= MIN_QUERY_LENGTH &&
              results.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-ui-bg-subtle transition-colors flex items-center gap-3"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleResultNavigation(hit)}
                  data-testid="search-result"
                >
                  <ThumbnailPreview hit={hit} />
                  <div className="min-w-0">
                    <p className="txt-compact-small-plus text-ui-fg-base truncate">
                      {hit.product.title ?? "Untitled product"}
                    </p>
                    <p className="txt-compact-small text-ui-fg-subtle truncate">
                      {hit.product.subtitle ||
                        hit.product.description ||
                        hit.metadata?.embedded_text ||
                        "View details"}
                    </p>
                  </div>
                </button>
              ))}

            {!error &&
              !isLoading &&
              trimmedQuery.length >= MIN_QUERY_LENGTH &&
              results.length === 0 && (
                <p className="px-4 py-3 text-sm text-ui-fg-muted">
                  No products matched your search.
                </p>
              )}
          </div>
        </div>
      )}
    </div>
  )
}

const ThumbnailPreview = ({ hit }: { hit: SemanticSearchHit }) => {
  const thumbnail = hit.product.thumbnail

  return thumbnail ? (
    <div className="w-12 h-12 flex-shrink-0 overflow-hidden rounded-md bg-ui-bg-subtle">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbnail}
        alt={hit.product.title ?? "Product thumbnail"}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  ) : (
    <div className="w-12 h-12 flex-shrink-0 rounded-md bg-ui-bg-subtle flex items-center justify-center text-ui-fg-muted text-xs">
      No image
    </div>
  )
}

const SearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="text-ui-fg-muted"
    aria-hidden="true"
  >
    <path
      d="M21 21L16.65 16.65M6 11C6 8.23858 8.23858 6 11 6C13.7614 6 16 8.23858 16 11C16 13.7614 13.7614 16 11 16C8.23858 16 6 13.7614 6 11Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default SearchBar
