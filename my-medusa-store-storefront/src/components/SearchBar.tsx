"use client"

import { semanticProductSearch, type SemanticSearchHit } from "@lib/search"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"

const MIN_QUERY_LENGTH = 2
const RESULT_LIMIT = 6
const DEBOUNCE_DELAY = 350

const SearchBar = () => {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SemanticSearchHit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latestQueryRef = useRef("")

  const trimmedQuery = query.trim()
  const showDropdown =
    isOpen &&
    (trimmedQuery.length > 0 ||
      isLoading ||
      !!error ||
      results.length > 0)

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
      return
    }

    setIsLoading(true)
    setError(null)

    debounceRef.current = setTimeout(async () => {
      latestQueryRef.current = trimmedQuery
      try {
        const response = await semanticProductSearch(
          trimmedQuery,
          RESULT_LIMIT
        )
        if (latestQueryRef.current === trimmedQuery) {
          setResults(response.hits)
        }
      } catch (err: any) {
        if (latestQueryRef.current === trimmedQuery) {
          const message =
            err instanceof Error ? err.message : "Unable to search right now"
          setResults([])
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
  }, [trimmedQuery])

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
      <div className="flex items-center gap-2 rounded-full border border-ui-border-base bg-ui-bg-field px-4 py-2 shadow-elevation-card-rest focus-within:border-ui-fg-base focus-within:shadow-elevation-card-hover transition-shadow">
        <SearchIcon />
        <input
          id="header-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder="Search products"
          className="w-full bg-transparent text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none"
          autoComplete="off"
        />
        {isLoading && (
          <span className="text-xs text-ui-fg-muted">Searching…</span>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 mt-2 rounded-large border border-ui-border-base bg-ui-bg-base shadow-elevation-card-rest z-50">
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
