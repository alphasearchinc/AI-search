import { Locator, Page, expect } from "@playwright/test"

/**
 * Page Object for the Search Modal functionality.
 * Encapsulates all interactions with SearchBar.tsx and its child components.
 */
export class SearchPage {
  readonly page: Page

  // Modal elements
  readonly searchTrigger: Locator
  readonly searchModal: Locator
  readonly searchInput: Locator
  readonly closeButton: Locator

  // Results
  readonly resultsList: Locator
  readonly resultCards: Locator
  readonly resultCount: Locator
  readonly noResultsMessage: Locator
  readonly loadingIndicator: Locator

  // Filters - Desktop
  readonly filtersSidebar: Locator
  readonly categoryFilters: Locator
  readonly brandFilters: Locator
  readonly priceMinInput: Locator
  readonly priceMaxInput: Locator
  readonly clearAllButton: Locator
  readonly activeFilterCount: Locator

  // Filters - Mobile
  readonly mobileFilterButton: Locator
  readonly mobileFilterDrawer: Locator
  readonly mobileApplyButton: Locator

  // Pagination
  readonly paginationContainer: Locator
  readonly prevPageButton: Locator
  readonly nextPageButton: Locator
  readonly pageButtons: Locator

  constructor(page: Page) {
    this.page = page

    // Modal elements
    this.searchTrigger = page.getByTestId("search-trigger")
    this.searchModal = page.getByTestId("search-modal")
    this.searchInput = page.getByTestId("search-input")
    this.closeButton = page.getByTestId("search-close")

    // Results
    this.resultsList = page.getByTestId("search-results")
    this.resultCards = page.getByTestId("product-card")
    this.resultCount = page.getByTestId("result-count")
    this.noResultsMessage = page.getByTestId("no-results")
    this.loadingIndicator = page.getByTestId("search-loading")

    // Filters - Desktop
    this.filtersSidebar = page.getByTestId("filters-sidebar")
    this.categoryFilters = page.getByTestId("category-filters")
    this.brandFilters = page.getByTestId("brand-filters")
    this.priceMinInput = page.getByTestId("price-min")
    this.priceMaxInput = page.getByTestId("price-max")
    this.clearAllButton = page.getByTestId("clear-filters")
    this.activeFilterCount = page.getByTestId("active-filter-count")

    // Filters - Mobile
    this.mobileFilterButton = page.getByTestId("mobile-filter-button")
    this.mobileFilterDrawer = page.getByTestId("mobile-filter-drawer")
    this.mobileApplyButton = page.getByTestId("mobile-apply-filters")

    // Pagination
    this.paginationContainer = page.getByTestId("pagination")
    this.prevPageButton = page.getByTestId("pagination-prev")
    this.nextPageButton = page.getByTestId("pagination-next")
    this.pageButtons = page.getByTestId("pagination-page")
  }

  /**
   * Navigate to the homepage and open the search modal.
   */
  async goto() {
    await this.page.goto("/")
  }

  /**
   * Open the search modal by clicking the search trigger.
   */
  async openModal() {
    await this.searchTrigger.click()
    await expect(this.searchModal).toBeVisible()
    await expect(this.searchInput).toBeFocused()
  }

  /**
   * Close the search modal.
   */
  async closeModal() {
    // Use dispatchEvent to bypass nav element interception
    await this.closeButton.dispatchEvent("click")
    await expect(this.searchModal).not.toBeVisible({ timeout: 10000 })
  }

  /**
   * Type a search query and wait for results.
   */
  async search(query: string) {
    await this.searchInput.fill(query)
    await this.waitForResults()
  }

  /**
   * Wait for search results to load (loading indicator disappears).
   */
  async waitForResults() {
    // Wait for debounce + API response
    await this.page.waitForTimeout(500)
    // Wait for loading to complete (increase timeout for slow responses)
    await expect(this.loadingIndicator).not.toBeVisible({ timeout: 50000 })
  }

  /**
   * Get the current result count from the UI.
   */
  async getResultCount(): Promise<number> {
    const text = await this.resultCount.textContent()
    const match = text?.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : 0
  }

  /**
   * Get the number of product cards currently visible.
   */
  async getVisibleResultCount(): Promise<number> {
    return await this.resultCards.count()
  }

  /**
   * Select a category filter by name.
   */
  async selectCategory(categoryName: string) {
    const checkbox = this.categoryFilters.getByLabel(categoryName)
    await checkbox.check()
    await this.waitForResults()
  }

  /**
   * Deselect a category filter by name.
   */
  async deselectCategory(categoryName: string) {
    const checkbox = this.categoryFilters.getByLabel(categoryName)
    await checkbox.uncheck()
    await this.waitForResults()
  }

  /**
   * Select a brand filter by name.
   */
  async selectBrand(brandName: string) {
    const checkbox = this.brandFilters.getByLabel(brandName)
    await checkbox.check()
    await this.waitForResults()
  }

  /**
   * Deselect a brand filter by name.
   */
  async deselectBrand(brandName: string) {
    const checkbox = this.brandFilters.getByLabel(brandName)
    await checkbox.uncheck()
    await this.waitForResults()
  }

  /**
   * Select an option filter (e.g., Color, Storage).
   */
  async selectOption(optionName: string, value: string) {
    const optionSection = this.page.getByTestId(`option-filter-${optionName}`)
    const checkbox = optionSection.getByLabel(value, { exact: true })
    await checkbox.check()
    await this.waitForResults()
  }

  /**
   * Deselect an option filter.
   */
  async deselectOption(optionName: string, value: string) {
    const optionSection = this.page.getByTestId(`option-filter-${optionName}`)
    const checkbox = optionSection.getByLabel(value, { exact: true })
    await checkbox.uncheck()
    await this.waitForResults()
  }

  /**
   * Set the price range filter.
   */
  async setPriceRange(min?: number, max?: number) {
    if (min !== undefined) {
      await this.priceMinInput.fill(min.toString())
    }
    if (max !== undefined) {
      await this.priceMaxInput.fill(max.toString())
    }
    await this.waitForResults()
  }

  /**
   * Clear the price range filter.
   */
  async clearPriceRange() {
    await this.priceMinInput.fill("")
    await this.priceMaxInput.fill("")
    await this.waitForResults()
  }

  /**
   * Clear all active filters.
   */
  async clearAllFilters() {
    await this.clearAllButton.click()
    await this.waitForResults()
  }

  /**
   * Get the count displayed on a facet (e.g., "Smartphones (15)").
   */
  async getFacetCount(
    filterType: "category" | "brand" | "option",
    name: string,
    optionName?: string
  ): Promise<number> {
    let container: Locator

    if (filterType === "category") {
      container = this.categoryFilters
    } else if (filterType === "brand") {
      container = this.brandFilters
    } else {
      container = this.page.getByTestId(`option-filter-${optionName}`)
    }

    const facetItem = container.locator(`text=${name}`).locator("..")
    const countBadge = facetItem.getByTestId("facet-count")
    const text = await countBadge.textContent()
    return parseInt(text || "0", 10)
  }

  /**
   * Get the number of active filters shown in the badge.
   */
  async getActiveFilterCount(): Promise<number> {
    const isVisible = await this.activeFilterCount.isVisible()
    if (!isVisible) return 0
    const text = await this.activeFilterCount.textContent()
    return parseInt(text || "0", 10)
  }

  /**
   * Navigate to a specific page.
   */
  async goToPage(pageNumber: number) {
    const pageButton = this.paginationContainer.getByRole("button", {
      name: pageNumber.toString(),
    })
    await pageButton.click()
    await this.waitForResults()
  }

  /**
   * Go to the next page.
   */
  async nextPage() {
    await this.nextPageButton.click()
    await this.waitForResults()
  }

  /**
   * Go to the previous page.
   */
  async prevPage() {
    await this.prevPageButton.click()
    await this.waitForResults()
  }

  /**
   * Check if a product with a specific title is in the results.
   */
  async hasProductWithTitle(title: string): Promise<boolean> {
    const product = this.resultCards.filter({ hasText: title })
    return (await product.count()) > 0
  }

  /**
   * Get all visible product titles.
   */
  async getProductTitles(): Promise<string[]> {
    const titles = await this.resultCards
      .getByTestId("product-title")
      .allTextContents()
    return titles
  }

  /**
   * Open mobile filter drawer (for mobile viewport tests).
   */
  async openMobileFilters() {
    await this.mobileFilterButton.click()
    await expect(this.mobileFilterDrawer).toBeVisible()
  }

  /**
   * Apply mobile filters and close drawer.
   */
  async applyMobileFilters() {
    await this.mobileApplyButton.click()
    await expect(this.mobileFilterDrawer).not.toBeVisible()
    await this.waitForResults()
  }

  /**
   * Select a filter in mobile mode using FilterPill.
   */
  async selectMobileFilter(
    filterType: "category" | "brand" | "option",
    name: string
  ) {
    const pill = this.mobileFilterDrawer.getByRole("button", { name })
    await pill.click()
  }
}
