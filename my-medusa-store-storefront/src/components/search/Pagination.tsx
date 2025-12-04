// Pagination component

import { ChevronLeftIcon, ChevronRightIcon } from "./icons"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) => {
  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | "...")[] = []
    const showPages = 5 // Max page buttons to show

    if (totalPages <= showPages + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > 3) {
        pages.push("...")
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push("...")
      }

      // Always show last page
      pages.push(totalPages)
    }

    return pages
  }

  return (
    <div
      data-testid="pagination"
      className="flex items-center justify-center gap-1 mt-8"
    >
      {/* Previous Button */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        data-testid="pagination-prev"
        className="flex items-center justify-center w-9 h-9 rounded-md border border-ui-border-base bg-ui-bg-base text-ui-fg-base hover:bg-ui-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeftIcon />
      </button>

      {/* Page Numbers */}
      {getPageNumbers().map((page, idx) =>
        page === "..." ? (
          <span
            key={`ellipsis-${idx}`}
            className="w-9 h-9 flex items-center justify-center text-ui-fg-muted"
          >
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            data-testid="pagination-page"
            className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${
              currentPage === page
                ? "bg-ui-fg-base text-ui-bg-base"
                : "border border-ui-border-base bg-ui-bg-base text-ui-fg-base hover:bg-ui-bg-subtle"
            }`}
          >
            {page}
          </button>
        )
      )}

      {/* Next Button */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        data-testid="pagination-next"
        className="flex items-center justify-center w-9 h-9 rounded-md border border-ui-border-base bg-ui-bg-base text-ui-fg-base hover:bg-ui-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Next page"
      >
        <ChevronRightIcon />
      </button>
    </div>
  )
}
