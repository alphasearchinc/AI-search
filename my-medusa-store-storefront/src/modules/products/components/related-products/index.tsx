import { getProductRecommendations } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import { RelatedProductsCarousel } from "./carousel"

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
}

export default async function RelatedProducts({
  product,
  countryCode,
}: RelatedProductsProps) {
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  // Get product recommendations using existing embedding (no search metrics pollution)
  const products = await getProductRecommendations({
    productId: product.id,
    limit: 12,
    countryCode,
  })

  if (!products.length) {
    return null
  }

  return (
    <div className="product-page-constraint">
      <div className="flex flex-col items-center text-center mb-16">
        <span className="text-base-regular text-gray-600 mb-6">
          Related products
        </span>
        <p className="text-2xl-regular text-ui-fg-base max-w-lg">
          You might also want to check out these products.
        </p>
      </div>

      <RelatedProductsCarousel products={products} region={region} />
    </div>
  )
}
