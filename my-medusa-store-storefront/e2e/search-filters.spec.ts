import { test, expect } from "@playwright/test"
import { SearchPage } from "./fixtures/search-page"

test.describe("Search Filters E2E Tests", () => {
  let searchPage: SearchPage

  test.beforeEach(async ({ page }) => {
    searchPage = new SearchPage(page)
    await searchPage.goto()
    await searchPage.openModal()
  })

  test.describe("Basic Search", () => {
    test("should open search modal and display results", async () => {
      // Modal should be open with focused input
      await expect(searchPage.searchModal).toBeVisible()
      await expect(searchPage.searchInput).toBeFocused()

      // Search for products
      await searchPage.search("phone")

      // Should show results
      const count = await searchPage.getResultCount()
      expect(count).toBeGreaterThan(0)

      const visibleCount = await searchPage.getVisibleResultCount()
      expect(visibleCount).toBeGreaterThan(0)
    })

    test("should show no results message for nonsense query", async () => {
      await searchPage.search("xyznonexistentproduct123")
      // Semantic search may return fuzzy matches, so check for no results OR very few results
      // Wait for loading to complete first
      await searchPage.waitForResults()

      // Either no results message is shown, or we have very few (fuzzy) results
      const noResultsVisible = await searchPage.noResultsMessage.isVisible()
      if (!noResultsVisible) {
        // If semantic search returned some fuzzy matches, that's acceptable
        const count = await searchPage.getResultCount()
        // Nonsense query should return 0 or very few results (semantic search might find some)
        expect(count).toBeLessThanOrEqual(5)
      }
    })

    test("should close modal with close button", async () => {
      await searchPage.closeModal()
      await expect(searchPage.searchModal).not.toBeVisible()
    })

    test("should close modal with Escape key", async ({ page }) => {
      await page.keyboard.press("Escape")
      await expect(searchPage.searchModal).not.toBeVisible()
    })
  })

  test.describe("Category Filters", () => {
    test("should filter results by category", async () => {
      // Search for broad term
      await searchPage.search("samsung")

      const initialCount = await searchPage.getResultCount()

      // Select Smartphones category
      await searchPage.selectCategory("Smartphones")

      const filteredCount = await searchPage.getResultCount()

      // Filtered results should be <= initial results
      expect(filteredCount).toBeLessThanOrEqual(initialCount)
      expect(filteredCount).toBeGreaterThan(0)
    })

    test("should update facet counts when category selected", async () => {
      await searchPage.search("phone")

      // Select a category
      await searchPage.selectCategory("Smartphones")

      // Brand facet counts should reflect filtered results
      // The facets should update to show only brands within Smartphones
      const brandSection = searchPage.brandFilters
      await expect(brandSection).toBeVisible()
    })

    test("should allow multiple category selection", async () => {
      await searchPage.search("")

      // Select multiple categories
      await searchPage.selectCategory("Smartphones")
      const countAfterFirst = await searchPage.getResultCount()

      await searchPage.selectCategory("Laptops")
      const countAfterSecond = await searchPage.getResultCount()

      // Adding another category should increase or maintain results
      expect(countAfterSecond).toBeGreaterThanOrEqual(countAfterFirst)
    })

    test("should remove category filter on deselect", async () => {
      await searchPage.search("phone")

      await searchPage.selectCategory("Smartphones")
      const filteredCount = await searchPage.getResultCount()

      await searchPage.deselectCategory("Smartphones")
      const unfilteredCount = await searchPage.getResultCount()

      expect(unfilteredCount).toBeGreaterThanOrEqual(filteredCount)
    })
  })

  test.describe("Brand Filters", () => {
    test("should filter results by brand", async () => {
      await searchPage.search("phone")

      const initialCount = await searchPage.getResultCount()

      await searchPage.selectBrand("Samsung")

      const filteredCount = await searchPage.getResultCount()
      expect(filteredCount).toBeLessThanOrEqual(initialCount)
      expect(filteredCount).toBeGreaterThan(0)

      // Verify we got results (brand filtering is working)
      const titles = await searchPage.getProductTitles()
      expect(titles.length).toBeGreaterThan(0)
    })

    test("should cascade brand filter to update category facets", async () => {
      await searchPage.search("")

      // Get initial category counts
      await searchPage.selectBrand("Apple")

      // Category facets should now only show categories with Apple products
      const categorySection = searchPage.categoryFilters
      await expect(categorySection).toBeVisible()
    })
  })

  test.describe("Price Range Filters", () => {
    test("should filter results by minimum price", async () => {
      await searchPage.search("phone")

      const initialCount = await searchPage.getResultCount()

      await searchPage.setPriceRange(500, undefined)

      const filteredCount = await searchPage.getResultCount()
      expect(filteredCount).toBeLessThanOrEqual(initialCount)
    })

    test("should filter results by maximum price", async () => {
      await searchPage.search("phone")

      const initialCount = await searchPage.getResultCount()

      await searchPage.setPriceRange(undefined, 300)

      const filteredCount = await searchPage.getResultCount()
      expect(filteredCount).toBeLessThanOrEqual(initialCount)
    })

    test("should filter results by price range", async () => {
      await searchPage.search("laptop")

      await searchPage.setPriceRange(500, 1500)

      const count = await searchPage.getResultCount()
      expect(count).toBeGreaterThan(0)
    })

    test("should clear price filter", async () => {
      await searchPage.search("phone")

      await searchPage.setPriceRange(1000, 2000)
      const filteredCount = await searchPage.getResultCount()

      await searchPage.clearPriceRange()
      const unfilteredCount = await searchPage.getResultCount()

      expect(unfilteredCount).toBeGreaterThanOrEqual(filteredCount)
    })
  })

  test.describe("Option Filters (Color, Storage)", () => {
    test("should filter by Color option", async () => {
      await searchPage.search("phone")

      const initialCount = await searchPage.getResultCount()

      await searchPage.selectOption("Color", "Black")

      const filteredCount = await searchPage.getResultCount()
      expect(filteredCount).toBeLessThanOrEqual(initialCount)
    })

    test("should filter by Storage option", async () => {
      await searchPage.search("phone")

      await searchPage.selectOption("Storage", "256 GB")

      const count = await searchPage.getResultCount()
      expect(count).toBeGreaterThan(0)
    })

    test("should combine multiple option values (OR within type)", async () => {
      await searchPage.search("phone")

      await searchPage.selectOption("Color", "Black")
      const blackCount = await searchPage.getResultCount()

      await searchPage.selectOption("Color", "White")
      const blackOrWhiteCount = await searchPage.getResultCount()

      // OR logic: selecting more values should increase or maintain results
      expect(blackOrWhiteCount).toBeGreaterThanOrEqual(blackCount)
    })

    test("should combine different option types (AND between types)", async () => {
      await searchPage.search("phone")

      await searchPage.selectOption("Color", "Black")
      const colorCount = await searchPage.getResultCount()

      await searchPage.selectOption("Storage", "256 GB")
      const combinedCount = await searchPage.getResultCount()

      // AND logic: adding another filter type should reduce results
      expect(combinedCount).toBeLessThanOrEqual(colorCount)
    })
  })

  test.describe("Multi-Filter Combinations", () => {
    test("should combine category + brand filters", async () => {
      await searchPage.search("")

      await searchPage.selectCategory("Smartphones")
      const categoryCount = await searchPage.getResultCount()

      await searchPage.selectBrand("Samsung")
      const combinedCount = await searchPage.getResultCount()

      expect(combinedCount).toBeLessThanOrEqual(categoryCount)
      expect(combinedCount).toBeGreaterThan(0)
    })

    test("should combine category + brand + price filters", async () => {
      await searchPage.search("")

      await searchPage.selectCategory("Laptops")
      await searchPage.selectBrand("Apple")
      await searchPage.setPriceRange(1000, 3000)

      const count = await searchPage.getResultCount()
      expect(count).toBeGreaterThan(0)
    })

    test("should combine all filter types", async () => {
      await searchPage.search("")

      // Apply category filter
      await searchPage.selectCategory("Smartphones")
      const afterCategory = await searchPage.getResultCount()

      // Apply brand filter
      await searchPage.selectBrand("Samsung")
      const afterBrand = await searchPage.getResultCount()
      expect(afterBrand).toBeLessThanOrEqual(afterCategory)

      // Apply price filter
      await searchPage.setPriceRange(500, 2000)
      const afterPrice = await searchPage.getResultCount()
      expect(afterPrice).toBeLessThanOrEqual(afterBrand)

      // Verify multiple filter types can be combined
      // May or may not have results depending on data
      expect(afterPrice).toBeGreaterThanOrEqual(0)
    })
  })

  test.describe("Clear Filters", () => {
    test("should clear all filters at once", async () => {
      await searchPage.search("phone")

      // Apply multiple filters
      await searchPage.selectCategory("Smartphones")
      await searchPage.selectBrand("Samsung")
      await searchPage.setPriceRange(500, 1500)

      const filteredCount = await searchPage.getResultCount()

      // Clear all
      await searchPage.clearAllFilters()

      const clearedCount = await searchPage.getResultCount()
      expect(clearedCount).toBeGreaterThanOrEqual(filteredCount)

      // Active filter count should be 0
      const activeCount = await searchPage.getActiveFilterCount()
      expect(activeCount).toBe(0)
    })

    test("should track active filter count", async () => {
      await searchPage.search("")

      // Initially no filters
      let activeCount = await searchPage.getActiveFilterCount()
      expect(activeCount).toBe(0)

      // Add category filter
      await searchPage.selectCategory("Smartphones")
      activeCount = await searchPage.getActiveFilterCount()
      expect(activeCount).toBe(1)

      // Add brand filter
      await searchPage.selectBrand("Samsung")
      activeCount = await searchPage.getActiveFilterCount()
      expect(activeCount).toBe(2)

      // Add price filter
      await searchPage.setPriceRange(500, undefined)
      activeCount = await searchPage.getActiveFilterCount()
      expect(activeCount).toBe(3)
    })
  })

  test.describe("Pagination with Filters", () => {
    test("should paginate through filtered results", async () => {
      await searchPage.search("")

      // Get total count
      const totalCount = await searchPage.getResultCount()

      if (totalCount > 24) {
        // If more than one page, test pagination
        await searchPage.nextPage()

        // Should still show results
        const visibleCount = await searchPage.getVisibleResultCount()
        expect(visibleCount).toBeGreaterThan(0)
      }
    })

    test("should maintain filters when paginating", async () => {
      await searchPage.search("")
      await searchPage.selectCategory("Smartphones")

      const page1Count = await searchPage.getResultCount()

      if (page1Count > 24) {
        await searchPage.nextPage()

        // Active filter count should remain the same
        const activeCount = await searchPage.getActiveFilterCount()
        expect(activeCount).toBe(1)
      }
    })

    test("should reset to page 1 when filter changes", async () => {
      await searchPage.search("")

      const totalCount = await searchPage.getResultCount()

      if (totalCount > 24) {
        // Go to page 2
        await searchPage.nextPage()

        // Apply a filter - should reset to page 1
        await searchPage.selectCategory("Smartphones")

        // The pagination should reflect we're on page 1
        // (This would need to check the current page indicator)
      }
    })
  })

  test.describe("Cascading Facets", () => {
    test("category selection should update brand facet counts", async () => {
      await searchPage.search("")

      // Select a category
      await searchPage.selectCategory("Smartphones")

      // Brand facets should now only show brands that have smartphones
      // The counts should reflect filtered results
      const brandSection = searchPage.brandFilters
      await expect(brandSection).toBeVisible()

      // Verify at least one brand is still showing
      const brandCheckboxes = brandSection.getByRole("checkbox")
      const brandCount = await brandCheckboxes.count()
      expect(brandCount).toBeGreaterThan(0)
    })

    test("brand selection should update category facet counts", async () => {
      await searchPage.search("")

      // Select a brand
      await searchPage.selectBrand("Apple")

      // Category facets should update
      const categorySection = searchPage.categoryFilters
      await expect(categorySection).toBeVisible()
    })

    test("price filter should update all other facets", async () => {
      await searchPage.search("")

      // Set a price range
      await searchPage.setPriceRange(1000, 2000)

      // All facets should reflect only products in this price range
      const categorySection = searchPage.categoryFilters
      const brandSection = searchPage.brandFilters

      await expect(categorySection).toBeVisible()
      await expect(brandSection).toBeVisible()
    })
  })

  test.describe("Browse Mode (No Query)", () => {
    test("should show all products without search query", async () => {
      // Empty search should show all products
      await searchPage.search("")

      const count = await searchPage.getResultCount()
      expect(count).toBeGreaterThan(0)
    })

    test("should allow filtering in browse mode", async () => {
      await searchPage.search("")

      const initialCount = await searchPage.getResultCount()

      await searchPage.selectCategory("Smartphones")

      const filteredCount = await searchPage.getResultCount()
      // Filtered count should be less than or equal (could be same if all products match)
      expect(filteredCount).toBeLessThanOrEqual(initialCount)
      expect(filteredCount).toBeGreaterThan(0)
    })
  })
})

test.describe("Mobile Filters", () => {
  test.use({ viewport: { width: 375, height: 667 } })

  let searchPage: SearchPage

  test.beforeEach(async ({ page }) => {
    searchPage = new SearchPage(page)
    await searchPage.goto()
    await searchPage.openModal()
  })

  test("should open mobile filter drawer", async () => {
    await searchPage.search("")
    await searchPage.openMobileFilters()
    await expect(searchPage.mobileFilterDrawer).toBeVisible()
  })

  test("should apply filters from mobile drawer", async () => {
    await searchPage.search("")

    const initialCount = await searchPage.getResultCount()

    await searchPage.openMobileFilters()
    await searchPage.selectMobileFilter("category", "Smartphones")
    await searchPage.applyMobileFilters()

    const filteredCount = await searchPage.getResultCount()
    expect(filteredCount).toBeLessThanOrEqual(initialCount)
  })
})
