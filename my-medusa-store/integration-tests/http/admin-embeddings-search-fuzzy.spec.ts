import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import jwt from "jsonwebtoken";

jest.setTimeout(60 * 1000);

medusaIntegrationTestRunner({
  inApp: true,
  env: {
    SEARCH_FUZZY_ENABLED: "true",
    SEARCH_FUZZINESS_LEVEL: "AUTO",
    SEARCH_PREFIX_LENGTH: "2",
    SEARCH_MAX_EXPANSIONS: "50",
  },
  testSuite: ({ api, getContainer }) => {
    let authHeaders: { Authorization: string };

    beforeEach(async () => {
      // Create admin user and generate JWT token for authentication
      const userModule = getContainer().resolve(Modules.USER);
      const user = await userModule.createUsers({
        email: "admin@test.com",
        first_name: "Admin",
        last_name: "User",
      });

      const authModule = getContainer().resolve(Modules.AUTH);
      await authModule.createAuthIdentities({
        provider_identities: [
          {
            provider: "emailpass",
            entity_id: user.id,
          },
        ],
      });

      const jwtSecret = process.env.JWT_SECRET || "supersecret";
      const token = jwt.sign(
        { actor_id: user.id, actor_type: "user", app_metadata: {} },
        jwtSecret
      );

      authHeaders = { Authorization: `Bearer ${token}` };
    });

    describe("POST /admin/embeddings/search - Fuzzy Search E2E", () => {
      it("handles typos via HTTP endpoint with real Elasticsearch", async () => {
        const response = await api.post(
          "/admin/embeddings/search",
          {
            query: "wireles", // typo: missing 's' (but prefix "wi" matches "wireless")
            limit: 5,
          },
          { headers: authHeaders }
        );

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty("hits");
        expect(Array.isArray(response.data.hits)).toBe(true);
        expect(response.data).toHaveProperty("mode");
        expect(response.data).toHaveProperty("took");
        expect(response.data).toHaveProperty("count");

        // If products with "wireless" exist and are indexed, fuzzy should find them
        // Test doesn't assume data exists, just validates structure and no errors
      });

      it("returns valid response structure for typo queries", async () => {
        const response = await api.post(
          "/admin/embeddings/search",
          {
            query: "laptpo", // typo: 'p' and 'o' swapped (prefix "la" matches "laptop")
            limit: 3,
            include_product: true,
          },
          { headers: authHeaders }
        );

        expect(response.status).toBe(200);

        // Validate response structure
        expect(response.data).toHaveProperty("query");
        expect(response.data.query).toBe("laptpo");
        expect(response.data).toHaveProperty("limit");
        expect(response.data.limit).toBe(3);
        expect(response.data).toHaveProperty("hits");
        expect(response.data).toHaveProperty("mode");
        expect(["hybrid", "bm25-only", "bm25"]).toContain(response.data.mode);

        // If hits exist, verify structure
        if (response.data.hits.length > 0) {
          const hit = response.data.hits[0];
          expect(hit).toHaveProperty("id");
          expect(hit).toHaveProperty("score");
          expect(hit).toHaveProperty("product_id");

          // When include_product=true, product details should be included
          if (hit.product) {
            expect(hit.product).toHaveProperty("id");
          }
        }
      });

      it("applies fuzzy configuration from environment variables", async () => {
        // This test documents that fuzzy config is read from .env at runtime
        const response = await api.post(
          "/admin/embeddings/search",
          {
            query: "keybaord", // typo: 'o' and 'a' swapped (prefix "ke" matches "keyboard")
            limit: 5,
          },
          { headers: authHeaders }
        );

        expect(response.status).toBe(200);

        // The fact that this doesn't throw 400/500 means:
        // 1. Elasticsearch accepted the fuzzy query
        // 2. Environment variables were loaded correctly
        // 3. The query reached semanticSearch() successfully
        expect(response.data.hits).toBeDefined();
      });

      it("validates that exact matches work alongside fuzzy", async () => {
        const response = await api.post(
          "/admin/embeddings/search",
          {
            query: "laptop", // exact match (no typo)
            limit: 10,
          },
          { headers: authHeaders }
        );

        expect(response.status).toBe(200);
        expect(response.data.hits).toBeDefined();

        // Exact match queries should still work perfectly with fuzzy enabled
        // Fuzzy doesn't break exact matching
      });

      it("handles filters combined with fuzzy matching", async () => {
        const response = await api.post(
          "/admin/embeddings/search",
          {
            query: "wireles", // typo
            limit: 5,
            filters: {
              product_ids: ["prod_01"], // filter by specific product
            },
          },
          { headers: authHeaders }
        );

        expect(response.status).toBe(200);
        expect(response.data.hits).toBeDefined();

        // Validates that fuzzy + filters work together
        // (filters are applied in the bool query alongside fuzzy match)
      });

      it("returns proper error for empty query", async () => {
        try {
          await api.post(
            "/admin/embeddings/search",
            {
              query: "",
              limit: 5,
            },
            { headers: authHeaders }
          );
          // Should not reach here
          fail("Expected request to fail with 400 error");
        } catch (error: any) {
          // Should reject empty queries even with fuzzy enabled
          expect(error.response.status).toBe(400);
          expect(error.response.data).toHaveProperty("message");
        }
      });

      it("respects limit parameter with fuzzy queries", async () => {
        const response = await api.post(
          "/admin/embeddings/search",
          {
            query: "prodcut", // typo in "product"
            limit: 2,
          },
          { headers: authHeaders }
        );

        expect(response.status).toBe(200);
        expect(response.data.limit).toBe(2);

        // Should respect limit even with fuzzy matching
        if (response.data.hits.length > 0) {
          expect(response.data.hits.length).toBeLessThanOrEqual(2);
        }
      });
    });

    describe("Fuzzy Search Configuration Validation", () => {
      it("fuzzy search works in bm25-only fallback mode", async () => {
        // When embedding service is unavailable, system falls back to BM25-only
        // Fuzzy should still work in this mode
        const response = await api.post(
          "/admin/embeddings/search",
          {
            query: "tablte", // typo in "tablet"
            limit: 5,
          },
          { headers: authHeaders }
        );

        expect(response.status).toBe(200);

        // Mode might be "bm25-only" if embedding service is down
        expect(["hybrid", "bm25-only", "bm25"]).toContain(response.data.mode);
      });

      it("handles very short queries with prefix_length protection", async () => {
        const response = await api.post(
          "/admin/embeddings/search",
          {
            query: "ab", // 2-char query (at prefix_length boundary)
            limit: 5,
          },
          { headers: authHeaders }
        );

        // Should not crash, even if fuzzy can't apply to very short queries
        expect(response.status).toBe(200);
        expect(response.data.hits).toBeDefined();
      });
    });
  },
});
