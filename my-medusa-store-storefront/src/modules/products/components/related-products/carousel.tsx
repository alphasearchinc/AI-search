"use client"

import useEmblaCarousel from "embla-carousel-react"
import { useCallback } from "react"
import { HttpTypes } from "@medusajs/types"
import Product from "../product-preview"

type CarouselProps = {
  products: HttpTypes.StoreProduct[]
  region: HttpTypes.StoreRegion
  itemsPerPage?: number
}

export function RelatedProductsCarousel({
  products,
  region,
  itemsPerPage = 4,
}: CarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    slidesToScroll: 1,
    breakpoints: {
      "(min-width: 768px)": { slidesToScroll: 4 },
    },
  })

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext()
  }, [emblaApi])

  if (!products.length) return null

  return (
    <div className="relative w-full group">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex -ml-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex-[0_0_50%] small:flex-[0_0_33.333%] medium:flex-[0_0_25%] min-w-0 pl-6"
            >
              <Product region={region} product={product} />
            </div>
          ))}
        </div>
      </div>

      {products.length > itemsPerPage && (
        <>
          <button
            type="button"
            onClick={scrollPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 bg-ui-bg-base shadow-elevation-card-rest rounded-full p-2 hover:bg-ui-bg-subtle transition-colors z-10 border border-ui-border-base opacity-0 group-hover:opacity-100 duration-300"
            aria-label="Previous"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={scrollNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 bg-ui-bg-base shadow-elevation-card-rest rounded-full p-2 hover:bg-ui-bg-subtle transition-colors z-10 border border-ui-border-base opacity-0 group-hover:opacity-100 duration-300"
            aria-label="Next"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}
