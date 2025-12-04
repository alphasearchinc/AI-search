// Product Card component for search results

import type { SemanticSearchHit } from "@lib/search"

interface ProductCardProps {
  hit: SemanticSearchHit
  onClick: () => void
}

const formatPrice = (amount: number): string => {
  // Format price - amount is stored in cents, divide by 100 for dollars
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

export const ProductCard = ({ hit, onClick }: ProductCardProps) => {
  const minPrice = hit.metadata?.min_price
  const maxPrice = hit.metadata?.max_price

  const priceDisplay = () => {
    if (typeof minPrice !== "number") return null
    if (typeof maxPrice === "number" && maxPrice !== minPrice) {
      return `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`
    }
    return formatPrice(minPrice)
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="product-card"
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
      <h4
        data-testid="product-title"
        className="text-sm font-medium text-ui-fg-base line-clamp-2 mb-1"
      >
        {hit.product.title ?? "Untitled"}
      </h4>
      {priceDisplay() && (
        <p
          data-testid="product-price"
          className="text-sm font-semibold text-ui-fg-base mb-1"
        >
          {priceDisplay()}
        </p>
      )}
      <p className="text-xs text-ui-fg-subtle line-clamp-2">
        {hit.product.subtitle || hit.product.description || "View product"}
      </p>
    </button>
  )
}
