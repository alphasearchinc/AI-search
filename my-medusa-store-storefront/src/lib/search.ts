export type SemanticSearchProduct = {
  id: string
  title?: string | null
  subtitle?: string | null
  description?: string | null
  handle?: string | null
  thumbnail?: string | null
}

export type SemanticSearchHit = {
  id: string
  score: number
  product: SemanticSearchProduct
  metadata?: Record<string, unknown>
}

export type CategoryFacet = {
  id: string
  name: string
  count: number
}

export type OptionFacet = {
  name: string
  values: Array<{ value: string; count: number }>
}

export type BrandFacet = {
  name: string
  count: number
}

export type PriceRange = {
  min: number
  max: number
}

export type SearchFacets = {
  categories: CategoryFacet[]
  brands?: BrandFacet[]
  priceRange?: PriceRange
  options?: OptionFacet[]
}

export type SemanticSearchResponse = {
  query: string
  limit: number
  took: number
  total: number
  count: number
  hits: SemanticSearchHit[]
  facets?: SearchFacets
}

const getBackendUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL

  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_MEDUSA_BACKEND_URL. Update .env.local in the storefront."
    )
  }

  return url.replace(/\/$/, "")
}

const getPublishableKey = (): string | undefined =>
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

export type SemanticSearchOptions = {
  query: string
  limit?: number
  offset?: number
  categoryIds?: string[]
  brands?: string[]
  minPrice?: number
  maxPrice?: number
  options?: Record<string, string[]>
  includeFacets?: boolean
}

export async function semanticProductSearch(
  options: SemanticSearchOptions | string,
  limit = 5
): Promise<SemanticSearchResponse> {
  // Support both old (query, limit) and new (options) signature
  const opts: SemanticSearchOptions =
    typeof options === "string" ? { query: options, limit } : options

  const sanitizedQuery = opts.query.trim()

  const backendUrl = getBackendUrl()
  const publishableKey = getPublishableKey()

  const response = await fetch(`${backendUrl}/store/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(publishableKey && { "x-publishable-api-key": publishableKey }),
    },
    body: JSON.stringify({
      query: sanitizedQuery,
      limit: opts.limit ?? limit,
      ...(opts.offset !== undefined && { offset: opts.offset }),
      ...(opts.categoryIds?.length && { category_ids: opts.categoryIds }),
      ...(opts.brands?.length && { brands: opts.brands }),
      ...(opts.minPrice !== undefined && { min_price: opts.minPrice }),
      ...(opts.maxPrice !== undefined && { max_price: opts.maxPrice }),
      ...(opts.options &&
        Object.keys(opts.options).length > 0 && { options: opts.options }),
      ...(opts.includeFacets !== undefined && {
        include_facets: opts.includeFacets,
      }),
    }),
    cache: "no-store",
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const errorMessage =
      data?.message || "Unable to complete semantic product search"
    throw new Error(errorMessage)
  }

  return data as SemanticSearchResponse
}
