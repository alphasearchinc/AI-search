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

export type SemanticSearchResponse = {
  query: string
  limit: number
  took: number
  total: number
  count: number
  hits: SemanticSearchHit[]
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

export async function semanticProductSearch(
  query: string,
  limit = 5
): Promise<SemanticSearchResponse> {
  const sanitizedQuery = query.trim()

  if (!sanitizedQuery) {
    throw new Error("Search query must not be empty")
  }

  const backendUrl = getBackendUrl()
  const publishableKey = getPublishableKey()

  const response = await fetch(`${backendUrl}/store/embeddings/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(publishableKey && { "x-publishable-api-key": publishableKey }),
    },
    body: JSON.stringify({
      query: sanitizedQuery,
      limit,
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
