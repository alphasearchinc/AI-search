// Product Card component for search results

import type { SemanticSearchHit } from "@lib/search"

interface ProductCardProps {
  hit: SemanticSearchHit
  onClick: () => void
}

export const ProductCard = ({ hit, onClick }: ProductCardProps) => (
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
