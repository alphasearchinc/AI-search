/**
 * Comprehensive unit tests for products.ts data layer
 * 
 * Tests cover:
 * - getSemanticRecommendations function
 * - API request handling
 * - Error handling and fallbacks
 * - Product filtering and sorting
 * - Edge cases
 */

import { getSemanticRecommendations } from "../products";
import { HttpTypes } from "@medusajs/types";

// Mock fetch
global.fetch = jest.fn();

describe("getSemanticRecommendations", () => {
  const mockBackendUrl = "http://localhost:9000";
  const mockPublishableKey = "pk_test_123";

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = mockBackendUrl;
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = mockPublishableKey;
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
    delete process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  });

  describe("Successful recommendations", () => {
    it("should return semantically similar products", async () => {
      const mockSearchResponse = {
        hits: [
          {
            id: "hit_1",
            score: 0.95,
            product: {
              id: "prod_rec_1",
              title: "Similar Laptop",
              handle: "similar-laptop",
            },
          },
          {
            id: "hit_2",
            score: 0.90,
            product: {
              id: "prod_rec_2",
              title: "Another Laptop",
              handle: "another-laptop",
            },
          },
        ],
        count: 2,
      };

      const mockProductsResponse = {
        products: [
          {
            id: "prod_rec_1",
            title: "Similar Laptop",
            handle: "similar-laptop",
            description: "A similar laptop",
          },
          {
            id: "prod_rec_2",
            title: "Another Laptop",
            handle: "another-laptop",
            description: "Another similar laptop",
          },
        ],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSearchResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProductsResponse,
        });

      const recommendations = await getSemanticRecommendations({
        productTitle: "Gaming Laptop",
        productDescription: "High-performance gaming laptop",
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].id).toBe("prod_rec_1");
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should exclude current product from results", async () => {
      const currentProductId = "prod_current";
      
      const mockSearchResponse = {
        hits: [
          {
            id: "hit_1",
            score: 0.95,
            product: { id: currentProductId, title: "Current Product" },
          },
          {
            id: "hit_2",
            score: 0.90,
            product: { id: "prod_rec_1", title: "Recommended Product" },
          },
        ],
        count: 2,
      };

      const mockProductsResponse = {
        products: [
          {
            id: "prod_rec_1",
            title: "Recommended Product",
          },
        ],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSearchResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProductsResponse,
        });

      const recommendations = await getSemanticRecommendations({
        productTitle: "Test Product",
        excludeProductId: currentProductId,
        limit: 4,
        countryCode: "us",
      });

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].id).toBe("prod_rec_1");
    });

    it("should respect limit parameter", async () => {
      const mockSearchResponse = {
        hits: Array(10).fill(null).map((_, i) => ({
          id: `hit_${i}`,
          score: 0.9 - i * 0.05,
          product: {
            id: `prod_${i}`,
            title: `Product ${i}`,
          },
        })),
        count: 10,
      };

      const mockProductsResponse = {
        products: Array(3).fill(null).map((_, i) => ({
          id: `prod_${i}`,
          title: `Product ${i}`,
        })),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSearchResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProductsResponse,
        });

      const recommendations = await getSemanticRecommendations({
        productTitle: "Test Product",
        excludeProductId: "prod_current",
        limit: 3,
        countryCode: "us",
      });

      expect(recommendations.length).toBeLessThanOrEqual(3);
      // Should request limit + 1 from search API to account for filtering
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"limit":4'),
        })
      );
    });

    it("should handle product with no description", async () => {
      const mockSearchResponse = {
        hits: [
          {
            id: "hit_1",
            score: 0.95,
            product: { id: "prod_rec_1", title: "Product" },
          },
        ],
        count: 1,
      };

      const mockProductsResponse = {
        products: [
          {
            id: "prod_rec_1",
            title: "Product",
          },
        ],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSearchResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProductsResponse,
        });

      const recommendations = await getSemanticRecommendations({
        productTitle: "Test Product",
        productDescription: null,
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(recommendations).toHaveLength(1);
      // Should use only title in query
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"query":"Test Product"'),
        })
      );
    });

    it("should truncate very long descriptions", async () => {
      const longDescription = "a".repeat(3000);
      
      const mockSearchResponse = {
        hits: [],
        count: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      await getSemanticRecommendations({
        productTitle: "Test",
        productDescription: longDescription,
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      const fetchCall = (fetch as jest.Mock).mock.calls[0][1];
      const body = JSON.parse(fetchCall.body);
      
      // Query should be truncated to 2000 characters
      expect(body.query.length).toBeLessThanOrEqual(2000);
    });

    it("should maintain semantic search order in results", async () => {
      const mockSearchResponse = {
        hits: [
          {
            id: "hit_1",
            score: 0.95,
            product: { id: "prod_3", title: "Product 3" },
          },
          {
            id: "hit_2",
            score: 0.90,
            product: { id: "prod_1", title: "Product 1" },
          },
          {
            id: "hit_3",
            score: 0.85,
            product: { id: "prod_2", title: "Product 2" },
          },
        ],
        count: 3,
      };

      // Products returned in different order from Medusa
      const mockProductsResponse = {
        products: [
          { id: "prod_1", title: "Product 1" },
          { id: "prod_2", title: "Product 2" },
          { id: "prod_3", title: "Product 3" },
        ],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSearchResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProductsResponse,
        });

      const recommendations = await getSemanticRecommendations({
        productTitle: "Test",
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      // Should maintain semantic search order (by score)
      expect(recommendations[0].id).toBe("prod_3");
      expect(recommendations[1].id).toBe("prod_1");
      expect(recommendations[2].id).toBe("prod_2");
    });
  });

  describe("Error handling", () => {
    it("should return empty array when backend URL is missing", async () => {
      delete process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;

      const recommendations = await getSemanticRecommendations({
        productTitle: "Test",
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(recommendations).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should return empty array when semantic search fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const recommendations = await getSemanticRecommendations({
        productTitle: "Test",
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(recommendations).toEqual([]);
    });

    it("should return empty array when network error occurs", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error")
      );

      const recommendations = await getSemanticRecommendations({
        productTitle: "Test",
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(recommendations).toEqual([]);
    });

    it("should return empty array when no search results found", async () => {
      const mockSearchResponse = {
        hits: [],
        count: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      const recommendations = await getSemanticRecommendations({
        productTitle: "Nonexistent Product XYZ123",
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(recommendations).toEqual([]);
    });

    it("should return empty array when all results are excluded", async () => {
      const currentProductId = "prod_current";
      
      const mockSearchResponse = {
        hits: [
          {
            id: "hit_1",
            score: 0.95,
            product: { id: currentProductId, title: "Current Product" },
          },
        ],
        count: 1,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      const recommendations = await getSemanticRecommendations({
        productTitle: "Test",
        excludeProductId: currentProductId,
        limit: 4,
        countryCode: "us",
      });

      expect(recommendations).toEqual([]);
    });

    it("should handle malformed search response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: "response" }),
      });

      const recommendations = await getSemanticRecommendations({
        productTitle: "Test",
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(recommendations).toEqual([]);
    });

    it("should handle product fetch failure", async () => {
      const mockSearchResponse = {
        hits: [
          {
            id: "hit_1",
            score: 0.95,
            product: { id: "prod_1", title: "Product 1" },
          },
        ],
        count: 1,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSearchResponse,
        })
        .mockRejectedValueOnce(new Error("Product fetch failed"));

      const recommendations = await getSemanticRecommendations({
        productTitle: "Test",
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(recommendations).toEqual([]);
    });
  });

  describe("API request validation", () => {
    it("should include publishable key in request headers", async () => {
      const mockSearchResponse = {
        hits: [],
        count: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      await getSemanticRecommendations({
        productTitle: "Test",
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-publishable-api-key": mockPublishableKey,
          }),
        })
      );
    });

    it("should send POST request to /store/search", async () => {
      const mockSearchResponse = {
        hits: [],
        count: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      await getSemanticRecommendations({
        productTitle: "Test",
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(fetch).toHaveBeenCalledWith(
        `${mockBackendUrl}/store/search`,
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should use cache: no-store", async () => {
      const mockSearchResponse = {
        hits: [],
        count: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      await getSemanticRecommendations({
        productTitle: "Test",
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cache: "no-store",
        })
      );
    });

    it("should remove trailing slash from backend URL", async () => {
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = "http://localhost:9000/";
      
      const mockSearchResponse = {
        hits: [],
        count: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      await getSemanticRecommendations({
        productTitle: "Test",
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:9000/store/search",
        expect.any(Object)
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle empty product title", async () => {
      const mockSearchResponse = {
        hits: [],
        count: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      const recommendations = await getSemanticRecommendations({
        productTitle: "",
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(recommendations).toEqual([]);
    });

    it("should handle special characters in product title", async () => {
      const specialTitle = "Product™ with émojis 🎧 & symbols @#$";
      
      const mockSearchResponse = {
        hits: [],
        count: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      await getSemanticRecommendations({
        productTitle: specialTitle,
        excludeProductId: "prod_current",
        limit: 4,
        countryCode: "us",
      });

      expect(fetch).toHaveBeenCalled();
    });

    it("should handle limit of 0", async () => {
      const mockSearchResponse = {
        hits: [],
        count: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      const recommendations = await getSemanticRecommendations({
        productTitle: "Test",
        excludeProductId: "prod_current",
        limit: 0,
        countryCode: "us",
      });

      expect(recommendations).toEqual([]);
    });

    it("should handle very large limit", async () => {
      const mockSearchResponse = {
        hits: [],
        count: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      await getSemanticRecommendations({
        productTitle: "Test",
        excludeProductId: "prod_current",
        limit: 1000,
        countryCode: "us",
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"limit":1001'),
        })
      );
    });
  });
});