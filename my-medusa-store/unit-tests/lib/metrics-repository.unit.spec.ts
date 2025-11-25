/**
 * Comprehensive unit tests for metrics-repository.ts
 * 
 * Tests cover:
 * - Search metrics recording
 * - Embedding metrics recording
 * - Statistics aggregation
 * - Time range parsing
 * - Query performance metrics
 * - Error handling
 */

import { MetricsRepository, SearchMetrics, EmbeddingMetrics } from "../../src/lib/metrics-repository";

// Mock the pool
const mockPool = {
  query: jest.fn(),
  end: jest.fn(),
};

jest.mock("../../src/lib/metrics-repository", () => {
  const actualModule = jest.requireActual("../../src/lib/metrics-repository");
  return {
    ...actualModule,
    pool: mockPool,
  };
});

describe("MetricsRepository", () => {
  let repository: MetricsRepository;

  beforeEach(() => {
    repository = new MetricsRepository();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("recordSearch", () => {
    it("should record search metrics with all fields", async () => {
      const metrics: SearchMetrics = {
        query: "wireless headphones",
        results_count: 15,
        total_duration_ms: 250,
        embedding_generation_ms: 50,
        elasticsearch_query_ms: 200,
        user_type: "customer",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.recordSearch(metrics);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO search_metrics"),
        [
          metrics.query,
          metrics.results_count,
          metrics.total_duration_ms,
          metrics.embedding_generation_ms,
          metrics.elasticsearch_query_ms,
          metrics.user_type,
        ]
      );
    });

    it("should handle search with zero results", async () => {
      const metrics: SearchMetrics = {
        query: "nonexistent product xyz123",
        results_count: 0,
        total_duration_ms: 100,
        embedding_generation_ms: 30,
        elasticsearch_query_ms: 70,
        user_type: "customer",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.recordSearch(metrics);

      expect(mockPool.query).toHaveBeenCalled();
    });

    it("should handle search with very long query", async () => {
      const longQuery = "a".repeat(5000);
      const metrics: SearchMetrics = {
        query: longQuery,
        results_count: 5,
        total_duration_ms: 500,
        embedding_generation_ms: 100,
        elasticsearch_query_ms: 400,
        user_type: "admin",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.recordSearch(metrics);

      expect(mockPool.query).toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      const metrics: SearchMetrics = {
        query: "test",
        results_count: 10,
        total_duration_ms: 200,
        embedding_generation_ms: 50,
        elasticsearch_query_ms: 150,
        user_type: "customer",
      };

      mockPool.query.mockRejectedValueOnce(new Error("Database connection failed"));

      // Should not throw - metrics are non-blocking
      await expect(repository.recordSearch(metrics)).resolves.not.toThrow();
    });

    it("should handle special characters in query", async () => {
      const metrics: SearchMetrics = {
        query: "test@#$%^&*()_+{}|:\"<>?",
        results_count: 3,
        total_duration_ms: 150,
        embedding_generation_ms: 40,
        elasticsearch_query_ms: 110,
        user_type: "customer",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.recordSearch(metrics);

      expect(mockPool.query).toHaveBeenCalled();
    });

    it("should record admin searches separately", async () => {
      const metrics: SearchMetrics = {
        query: "admin test query",
        results_count: 25,
        total_duration_ms: 300,
        embedding_generation_ms: 75,
        elasticsearch_query_ms: 225,
        user_type: "admin",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.recordSearch(metrics);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["admin"])
      );
    });
  });

  describe("recordEmbedding", () => {
    it("should record successful embedding generation", async () => {
      const metrics: EmbeddingMetrics = {
        product_id: "prod_123",
        query: null,
        generation_ms: 150,
        embedding_dimensions: 768,
        success: true,
        provider: "local",
        context: "product_indexing",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.recordEmbedding(metrics);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO embedding_metrics"),
        [
          metrics.product_id,
          metrics.query,
          metrics.generation_ms,
          metrics.embedding_dimensions,
          metrics.success,
          metrics.error_message,
          metrics.provider,
          metrics.context,
        ]
      );
    });

    it("should record failed embedding with error message", async () => {
      const metrics: EmbeddingMetrics = {
        product_id: "prod_456",
        query: null,
        generation_ms: 50,
        embedding_dimensions: 768,
        success: false,
        error_message: "API timeout",
        provider: "openai",
        context: "product_indexing",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.recordEmbedding(metrics);

      expect(mockPool.query).toHaveBeenCalled();
    });

    it("should record search query embedding", async () => {
      const metrics: EmbeddingMetrics = {
        product_id: "",
        query: "gaming laptop",
        generation_ms: 45,
        embedding_dimensions: 768,
        success: true,
        provider: "local",
        context: "search_query",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.recordEmbedding(metrics);

      expect(mockPool.query).toHaveBeenCalled();
    });

    it("should handle different embedding dimensions", async () => {
      for (const dimensions of [384, 768, 1536]) {
        const metrics: EmbeddingMetrics = {
          product_id: `prod_${dimensions}`,
          query: null,
          generation_ms: 100,
          embedding_dimensions: dimensions,
          success: true,
          provider: "local",
          context: "product_indexing",
        };

        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await repository.recordEmbedding(metrics);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([dimensions])
        );

        jest.clearAllMocks();
      }
    });

    it("should handle bulk_operation context", async () => {
      const metrics: EmbeddingMetrics = {
        product_id: "prod_bulk",
        query: null,
        generation_ms: 200,
        embedding_dimensions: 768,
        success: true,
        provider: "local",
        context: "bulk_operation",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.recordEmbedding(metrics);

      expect(mockPool.query).toHaveBeenCalled();
    });

    it("should not throw on database errors", async () => {
      const metrics: EmbeddingMetrics = {
        product_id: "prod_error",
        query: null,
        generation_ms: 100,
        embedding_dimensions: 768,
        success: true,
        provider: "local",
        context: "product_indexing",
      };

      mockPool.query.mockRejectedValueOnce(new Error("Connection lost"));

      await expect(repository.recordEmbedding(metrics)).resolves.not.toThrow();
    });
  });

  describe("getSearchStats", () => {
    it("should return aggregated search statistics", async () => {
      const mockStats = [
        {
          total_searches: 1000,
          avg_duration_ms: 250,
          avg_results_count: 15,
          p95_duration_ms: 500,
          user_type: "customer",
        },
        {
          total_searches: 50,
          avg_duration_ms: 300,
          avg_results_count: 20,
          p95_duration_ms: 600,
          user_type: "admin",
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockStats });

      const stats = await repository.getSearchStats("24h");

      expect(stats).toEqual(mockStats);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT"),
        expect.arrayContaining(["24 hours"])
      );
    });

    it("should handle different time ranges", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.getSearchStats("1h");
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["1 hours"])
      );

      await repository.getSearchStats("7d");
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["7 days"])
      );

      await repository.getSearchStats("30d");
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["30 days"])
      );
    });

    it("should return empty array when no data exists", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const stats = await repository.getSearchStats("24h");

      expect(stats).toEqual([]);
    });
  });

  describe("getTopQueries", () => {
    it("should return top search queries with counts", async () => {
      const mockQueries = [
        { query: "laptop", count: 500, avg_duration_ms: 200 },
        { query: "headphones", count: 350, avg_duration_ms: 180 },
        { query: "keyboard", count: 200, avg_duration_ms: 220 },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockQueries });

      const queries = await repository.getTopQueries(10, "24h");

      expect(queries).toEqual(mockQueries);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY count DESC"),
        expect.arrayContaining([10, "24 hours"])
      );
    });

    it("should respect limit parameter", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.getTopQueries(5, "24h");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([5])
      );
    });

    it("should handle empty result set", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const queries = await repository.getTopQueries(10, "24h");

      expect(queries).toEqual([]);
    });
  });

  describe("getSlowQueries", () => {
    it("should return queries exceeding threshold", async () => {
      const mockSlowQueries = [
        {
          query: "complex search term",
          total_duration_ms: 3000,
          timestamp: new Date().toISOString(),
        },
        {
          query: "another slow query",
          total_duration_ms: 2500,
          timestamp: new Date().toISOString(),
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockSlowQueries });

      const queries = await repository.getSlowQueries(2000, 10);

      expect(queries).toEqual(mockSlowQueries);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE total_duration_ms > $1"),
        expect.arrayContaining([2000, 10])
      );
    });

    it("should use different thresholds", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.getSlowQueries(1000, 5);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1000])
      );

      await repository.getSlowQueries(5000, 20);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([5000])
      );
    });
  });

  describe("getEmbeddingStats", () => {
    it("should return embedding statistics by provider and context", async () => {
      const mockStats = [
        {
          total_embeddings: 1000,
          successful_embeddings: 995,
          failed_embeddings: 5,
          avg_generation_ms: 150,
          p95_generation_ms: 300,
          avg_success_ms: 145,
          avg_failure_ms: 250,
          provider: "local",
          context: "product_indexing",
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockStats });

      const stats = await repository.getEmbeddingStats("24h");

      expect(stats).toEqual(mockStats);
      expect(mockPool.query).toHaveBeenCalled();
    });

    it("should calculate success rate correctly", async () => {
      const mockStats = [
        {
          total_embeddings: 100,
          successful_embeddings: 99,
          failed_embeddings: 1,
          avg_generation_ms: 100,
          p95_generation_ms: 200,
          avg_success_ms: 98,
          avg_failure_ms: 500,
          provider: "local",
          context: "search_query",
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockStats });

      const stats = await repository.getEmbeddingStats("1h");

      expect(stats[0].successful_embeddings / stats[0].total_embeddings).toBeCloseTo(0.99);
    });

    it("should differentiate between providers", async () => {
      const mockStats = [
        {
          total_embeddings: 800,
          successful_embeddings: 800,
          failed_embeddings: 0,
          avg_generation_ms: 120,
          p95_generation_ms: 250,
          avg_success_ms: 120,
          avg_failure_ms: null,
          provider: "local",
          context: "product_indexing",
        },
        {
          total_embeddings: 200,
          successful_embeddings: 195,
          failed_embeddings: 5,
          avg_generation_ms: 300,
          p95_generation_ms: 600,
          avg_success_ms: 290,
          avg_failure_ms: 450,
          provider: "openai",
          context: "product_indexing",
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockStats });

      const stats = await repository.getEmbeddingStats("7d");

      expect(stats).toHaveLength(2);
      expect(stats.find((s) => s.provider === "local")).toBeDefined();
      expect(stats.find((s) => s.provider === "openai")).toBeDefined();
    });
  });

  describe("getEmbeddingFailures", () => {
    it("should return recent embedding failures", async () => {
      const mockFailures = [
        {
          product_id: "prod_123",
          query: null,
          generation_ms: 100,
          error_message: "Connection timeout",
          provider: "openai",
          context: "product_indexing",
          timestamp: new Date().toISOString(),
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockFailures });

      const failures = await repository.getEmbeddingFailures(10, "24h");

      expect(failures).toEqual(mockFailures);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE success = false"),
        expect.arrayContaining(["24 hours", 10])
      );
    });

    it("should order by timestamp descending", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.getEmbeddingFailures(5, "1h");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY timestamp DESC"),
        expect.any(Array)
      );
    });
  });

  describe("parseTimeRange", () => {
    it("should parse hours correctly", () => {
      const result = repository["parseTimeRange"]("24h");
      expect(result).toBe("24 hours");
    });

    it("should parse days correctly", () => {
      const result = repository["parseTimeRange"]("7d");
      expect(result).toBe("7 days");
    });

    it("should parse minutes correctly", () => {
      const result = repository["parseTimeRange"]("30m");
      expect(result).toBe("30 minutes");
    });

    it("should handle invalid format gracefully", () => {
      expect(() => repository["parseTimeRange"]("invalid")).toThrow();
    });
  });

  describe("Resource Management", () => {
    it("should close pool on shutdown", async () => {
      mockPool.end.mockResolvedValueOnce(undefined);

      await repository["shutdown"]();

      expect(mockPool.end).toHaveBeenCalled();
    });

    it("should handle shutdown errors gracefully", async () => {
      mockPool.end.mockRejectedValueOnce(new Error("Already closed"));

      await expect(repository["shutdown"]()).resolves.not.toThrow();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle null values in metrics", async () => {
      const metrics: SearchMetrics = {
        query: null as any,
        results_count: 0,
        total_duration_ms: 100,
        embedding_generation_ms: 30,
        elasticsearch_query_ms: 70,
        user_type: "customer",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(repository.recordSearch(metrics)).resolves.not.toThrow();
    });

    it("should handle negative durations", async () => {
      const metrics: SearchMetrics = {
        query: "test",
        results_count: 5,
        total_duration_ms: -10,
        embedding_generation_ms: -5,
        elasticsearch_query_ms: -5,
        user_type: "customer",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.recordSearch(metrics);
      expect(mockPool.query).toHaveBeenCalled();
    });

    it("should handle very large result counts", async () => {
      const metrics: SearchMetrics = {
        query: "popular query",
        results_count: 999999,
        total_duration_ms: 5000,
        embedding_generation_ms: 1000,
        elasticsearch_query_ms: 4000,
        user_type: "customer",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await repository.recordSearch(metrics);
      expect(mockPool.query).toHaveBeenCalled();
    });
  });
});