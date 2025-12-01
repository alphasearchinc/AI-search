import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright configuration for E2E testing the search filter functionality.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,
  /* Test timeout - longer in CI due to slower services */
  timeout: process.env.CI ? 60000 : 30000,
  /* Reporter to use */
  reporter: [["html", { open: "never" }], ["list"]],
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: "http://localhost:8000",
    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",
    /* Capture screenshot on failure */
    screenshot: "only-on-failure",
    /* Video recording */
    video: "retain-on-failure",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    /* Test against mobile viewports */
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],

  /*
   * Web server config - commented out for manual server management.
   * Uncomment if you want Playwright to auto-start the frontend.
   * Make sure no other server is running on port 8000.
   */
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:8000",
  //   reuseExistingServer: true,
  //   timeout: 120 * 1000,
  // },
})
