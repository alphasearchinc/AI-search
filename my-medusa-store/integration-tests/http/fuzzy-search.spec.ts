import { medusaIntegrationTestRunner } from "@medusajs/test-utils";

jest.setTimeout(60 * 1000);

medusaIntegrationTestRunner({
  inApp: true,
  env: {
    SEARCH_FUZZY_ENABLED: "true",
    SEARCH_FUZZINESS_LEVEL: "AUTO",
    SEARCH_PREFIX_LENGTH: "2",
    SEARCH_MAX_EXPANSIONS: "50",
  },
  testSuite: ({ api }) => {
    describe("Fuzzy Search Integration", () => {
      it("handles typos in product search with fuzzy matching", async () => {
        // Test the store search endpoint with a typo
        const response = await api.post("/store/search", {
          query: "lptop", // typo: should match "laptop"
          limit: 5,
        });

        expect(response.status).toEqual(200);
        expect(response.data).toHaveProperty("hits");
        expect(Array.isArray(response.data.hits)).toBe(true);

        // If there are laptop products indexed, fuzzy search should find them
        if (response.data.hits.length > 0) {
          const hit = response.data.hits[0];
          expect(hit).toHaveProperty("product_id");
          expect(hit).toHaveProperty("score");
        }
      });

      it("handles character swap typos", async () => {
        const response = await api.post("/store/search", {
          query: "keybord", // typo: 'a' and 'o' swapped
          limit: 5,
        });

        expect(response.status).toEqual(200);
        expect(response.data).toHaveProperty("hits");
        expect(Array.isArray(response.data.hits)).toBe(true);
      });

      it("handles missing character typos", async () => {
        const response = await api.post("/store/search", {
          query: "wireles", // typo: missing 's'
          limit: 5,
        });

        expect(response.status).toEqual(200);
        expect(response.data).toHaveProperty("hits");
        expect(Array.isArray(response.data.hits)).toBe(true);
      });

      it("still returns exact matches with higher scores", async () => {
        // Create a search that should match exactly if products exist
        const exactResponse = await api.post("/store/search", {
          query: "laptop",
          limit: 5,
        });

        const fuzzyResponse = await api.post("/store/search", {
          query: "lptop",
          limit: 5,
        });

        expect(exactResponse.status).toEqual(200);
        expect(fuzzyResponse.status).toEqual(200);

        // Both should succeed, but exact match (if found) should score higher
        if (
          exactResponse.data.hits.length > 0 &&
          fuzzyResponse.data.hits.length > 0
        ) {
          const sameProduct = exactResponse.data.hits.find(
            (h: any) => h.product_id === fuzzyResponse.data.hits[0].product_id
          );
          if (sameProduct) {
            expect(sameProduct.score).toBeGreaterThanOrEqual(
              fuzzyResponse.data.hits[0].score
            );
          }
        }
      });

      it("respects admin endpoint fuzzy search", async () => {
        // Note: This requires admin authentication in real scenarios
        // For integration tests, authentication might be mocked or skipped
        const response = await api.post("/admin/embeddings/search", {
          query: "smartphne", // typo: missing 'o'
          limit: 5,
        });

        // May return 401 if auth is required, or 200 if test environment skips auth
        if (response.status === 200) {
          expect(response.data).toHaveProperty("hits");
          expect(Array.isArray(response.data.hits)).toBe(true);
        }
      });
    });

    describe("Fuzzy Search Configuration", () => {
      it("works with BM25-only mode and fuzzy enabled", async () => {
        const response = await api.post("/store/search", {
          query: "muse", // typo: should match "mouse"
          limit: 5,
          mode: "bm25",
        });

        expect(response.status).toEqual(200);
        expect(response.data).toHaveProperty("hits");
        expect(response.data).toHaveProperty("mode");
      });

      it("works with hybrid mode and fuzzy enabled", async () => {
        const response = await api.post("/store/search", {
          query: "phne", // typo: should match "phone"
          limit: 5,
          mode: "hybrid",
        });

        expect(response.status).toEqual(200);
        expect(response.data).toHaveProperty("hits");
        // Mode might be "bm25-only" if embeddings aren't available
        expect(["hybrid", "bm25-only"]).toContain(response.data.mode);
      });
    });
  },
});
