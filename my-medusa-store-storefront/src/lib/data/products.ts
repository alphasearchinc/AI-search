"use server"

import { sdk } from "@lib/config"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { getRegion, retrieveRegion } from "./regions"

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
  }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          fields:
            "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags,",
          ...queryParams,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products,
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> => {
  const limit = queryParams?.limit || 12

  const {
    response: { products, count },
  } = await listProducts({
    pageParam: 0,
    queryParams: {
      ...queryParams,
      limit: 100,
    },
    countryCode,
  })

  const sortedProducts = sortProducts(products, sortBy)

  const pageParam = (page - 1) * limit

  const nextPage = count > pageParam + limit ? pageParam + limit : null

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit)

  return {
    response: {
      products: paginatedProducts,
      count,
    },
    nextPage,
    queryParams,
  }
}

type SemanticSearchHit = {
  id: string
  score: number
  product: {
    id: string
    title?: string | null
    subtitle?: string | null
    description?: string | null
    handle?: string | null
    thumbnail?: string | null
  }
}

type SemanticSearchResponse = {
  hits: SemanticSearchHit[]
  count: number
}

/**
 * Get semantically similar product recommendations based on a product's content
 */
export const getSemanticRecommendations = async ({
  productTitle,
  productDescription,
  excludeProductId,
  limit = 4,
  countryCode,
}: {
  productTitle: string
  productDescription?: string | null
  excludeProductId: string
  limit?: number
  countryCode: string
}): Promise<HttpTypes.StoreProduct[]> => {
  try {
    // Construct search query from product title and description
    const query = productDescription
      ? `${productTitle} ${productDescription}`.slice(0, 2000)
      : productTitle

    const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL?.replace(
      /\/$/,
      ""
    )
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

    if (!backendUrl) {
      console.error(
        "Missing NEXT_PUBLIC_MEDUSA_BACKEND_URL for semantic recommendations"
      )
      return []
    }

    // Call semantic search endpoint
    const response = await fetch(`${backendUrl}/store/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(publishableKey && { "x-publishable-api-key": publishableKey }),
      },
      body: JSON.stringify({
        query,
        limit: limit + 1, // Request extra to account for filtering current product
      }),
      cache: "no-store",
    })

    if (!response.ok) {
      console.error(
        `Semantic search failed: ${response.status} ${response.statusText}`
      )
      return []
    }

    const data: SemanticSearchResponse = await response.json()

    // Filter out the current product and get product IDs
    const recommendedProductIds = data.hits
      .filter((hit) => hit.product.id !== excludeProductId)
      .slice(0, limit)
      .map((hit) => hit.product.id)

    if (recommendedProductIds.length === 0) {
      return []
    }

    // Fetch full product details from Medusa
    const { response: fullProducts } = await listProducts({
      queryParams: {
        id: recommendedProductIds,
      },
      countryCode,
    })

    // Sort by semantic search order
    const productMap = new Map(fullProducts.products.map((p) => [p.id, p]))
    const sortedProducts = recommendedProductIds
      .map((id) => productMap.get(id))
      .filter((p): p is HttpTypes.StoreProduct => p !== undefined)

    return sortedProducts
  } catch (error) {
    console.error("Error fetching semantic recommendations:", error)
    return []
  }
}

/**
 * Get product recommendations using the product's existing embedding
 * Does not pollute search metrics
 */
export const getProductRecommendations = async ({
  productId,
  limit = 4,
  countryCode,
}: {
  productId: string
  limit?: number
  countryCode: string
}): Promise<HttpTypes.StoreProduct[]> => {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL?.replace(
      /\/$/,
      ""
    )
    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

    if (!backendUrl) {
      console.error(
        "Missing NEXT_PUBLIC_MEDUSA_BACKEND_URL for recommendations"
      )
      return []
    }

    const response = await fetch(
      `${backendUrl}/store/recommendations/${productId}?limit=${limit}`,
      {
        headers: {
          ...(publishableKey && { "x-publishable-api-key": publishableKey }),
        },
        next: {
          tags: ["recommendations", productId],
          revalidate: 3600,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        console.debug(
          `Product ${productId} not yet embedded, skipping recommendations`
        )
      } else {
        console.warn(
          `Recommendations failed: ${response.status} ${response.statusText}`
        )
      }
      return []
    }

    const data: { recommendations: Array<{ product_id: string }> } =
      await response.json()

    const recommendedProductIds = data.recommendations.map(
      (rec) => rec.product_id
    )

    if (recommendedProductIds.length === 0) {
      return []
    }

    const { response: fullProducts } = await listProducts({
      queryParams: {
        id: recommendedProductIds,
      },
      countryCode,
    })

    const productMap = new Map(fullProducts.products.map((p) => [p.id, p]))
    const sortedProducts = recommendedProductIds
      .map((id) => productMap.get(id))
      .filter((p): p is HttpTypes.StoreProduct => p !== undefined)

    return sortedProducts
  } catch (error) {
    console.error("Error fetching product recommendations:", error)
    return []
  }
}
