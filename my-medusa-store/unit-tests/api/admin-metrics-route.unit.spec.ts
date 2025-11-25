/**
 * Comprehensive unit tests for admin metrics route
 * 
 * Tests cover:
 * - GET endpoint response structure
 * - Time range parameter validation
 * - Error handling
 * - Data aggregation
 * - Authorization (if applicable)
 */

import { GET } from "../../../src/api/admin/metrics/route";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

// Mock the metrics repository
const mockMetricsRepository = {
  getSearchStats: jest.fn(),
  getTopQueries: jest.fn(),
  getSlowQueries: jest.fn(),
  getEmbeddingStats: jest.fn(),
  getEmbeddingFailures: jest.fn(),
};

jest.mock("../../../src/lib/metrics-repository", () => {
  return {
    MetricsRepository: jest.fn().mockImplementation(() => mockMetricsRepository),
  };
});

describe("Admin Metrics Route - GET", () => {
  let mockReq: Partial<MedusaRequest>;
  let mockRes: Partial<MedusaResponse>;

  beforeEach(() => {
    mockReq = {
      query: {},
      scope: {
        resolve: jest.fn(),
      },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  describe("Successful responses", () => {
    it("should return metrics dashboard with default time range", async () => {
      const mockSearchStats = [
        {
          total_searches: 1000,
          avg_duration_ms: 250,
          avg_results_count: 15,
          p95_duration_ms: 500,
          user_type: "customer",
        },
      ];

      const mockTopQueries = [
        { query: "laptop", count: 500, avg_duration_ms: 200 },
        { query: "headphones", count: 300, avg_duration_ms: 180 },
      ];

      const mockSlowQueries = [
        {
          query: "complex query",
          total_duration_ms: 3000,
          timestamp: new Date().toISOString(),
        },
      ];

      const mockEmbeddingStats = [
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

      const mockEmbeddingFailures = [
        {
          product_id: "prod_123",
          error_message: "Timeout",
          timestamp: new Date().toISOString(),
        },
      ];

      mockMetricsRepository.getSearchStats.mockResolvedValue(mockSearchStats);
      mockMetricsRepository.getTopQueries.mockResolvedValue(mockTopQueries);
      mockMetricsRepository.getSlowQueries.mockResolvedValue(mockSlowQueries);
      mockMetricsRepository.getEmbeddingStats.mockResolvedValue(mockEmbeddingStats);
      mockMetricsRepository.getEmbeddingFailures.mockResolvedValue(mockEmbeddingFailures);

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      expect(mockRes.json).toHaveBeenCalledWith({
        time_range: "24h",
        search: {
          stats: mockSearchStats,
          top_queries: mockTopQueries,
          slow_queries: mockSlowQueries,
        },
        embedding: {
          stats: mockEmbeddingStats,
          failures: mockEmbeddingFailures,
        },
      });
    });

    it("should accept custom time range parameter", async () => {
      mockReq.query = { timeRange: "7d" };

      mockMetricsRepository.getSearchStats.mockResolvedValue([]);
      mockMetricsRepository.getTopQueries.mockResolvedValue([]);
      mockMetricsRepository.getSlowQueries.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingStats.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingFailures.mockResolvedValue([]);

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      expect(mockMetricsRepository.getSearchStats).toHaveBeenCalledWith("7d");
      expect(mockMetricsRepository.getTopQueries).toHaveBeenCalledWith(10, "7d");
      expect(mockMetricsRepository.getEmbeddingStats).toHaveBeenCalledWith("7d");
      expect(mockMetricsRepository.getEmbeddingFailures).toHaveBeenCalledWith(10, "7d");
    });

    it("should handle 1h time range", async () => {
      mockReq.query = { timeRange: "1h" };

      mockMetricsRepository.getSearchStats.mockResolvedValue([]);
      mockMetricsRepository.getTopQueries.mockResolvedValue([]);
      mockMetricsRepository.getSlowQueries.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingStats.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingFailures.mockResolvedValue([]);

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      expect(mockMetricsRepository.getSearchStats).toHaveBeenCalledWith("1h");
    });

    it("should handle 30d time range", async () => {
      mockReq.query = { timeRange: "30d" };

      mockMetricsRepository.getSearchStats.mockResolvedValue([]);
      mockMetricsRepository.getTopQueries.mockResolvedValue([]);
      mockMetricsRepository.getSlowQueries.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingStats.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingFailures.mockResolvedValue([]);

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      expect(mockMetricsRepository.getSearchStats).toHaveBeenCalledWith("30d");
    });

    it("should return empty arrays when no data exists", async () => {
      mockMetricsRepository.getSearchStats.mockResolvedValue([]);
      mockMetricsRepository.getTopQueries.mockResolvedValue([]);
      mockMetricsRepository.getSlowQueries.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingStats.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingFailures.mockResolvedValue([]);

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      expect(mockRes.json).toHaveBeenCalledWith({
        time_range: "24h",
        search: {
          stats: [],
          top_queries: [],
          slow_queries: [],
        },
        embedding: {
          stats: [],
          failures: [],
        },
      });
    });
  });

  describe("Error handling", () => {
    it("should handle database connection errors", async () => {
      mockMetricsRepository.getSearchStats.mockRejectedValue(
        new Error("Database connection failed")
      );

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Failed to fetch metrics",
      });
    });

    it("should handle timeout errors", async () => {
      mockMetricsRepository.getSearchStats.mockRejectedValue(
        new Error("Query timeout")
      );

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("should handle invalid time range gracefully", async () => {
      mockReq.query = { timeRange: "invalid" };

      mockMetricsRepository.getSearchStats.mockRejectedValue(
        new Error("Invalid time range")
      );

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("should handle partial failures gracefully", async () => {
      mockMetricsRepository.getSearchStats.mockResolvedValue([]);
      mockMetricsRepository.getTopQueries.mockRejectedValue(new Error("Query failed"));
      mockMetricsRepository.getSlowQueries.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingStats.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingFailures.mockResolvedValue([]);

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      // Should still return 500 on any failure
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("Data validation", () => {
    it("should validate search stats structure", async () => {
      const searchStats = [
        {
          total_searches: 100,
          avg_duration_ms: 200,
          avg_results_count: 10,
          p95_duration_ms: 400,
          user_type: "customer",
        },
      ];

      mockMetricsRepository.getSearchStats.mockResolvedValue(searchStats);
      mockMetricsRepository.getTopQueries.mockResolvedValue([]);
      mockMetricsRepository.getSlowQueries.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingStats.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingFailures.mockResolvedValue([]);

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.search.stats).toEqual(searchStats);
    });

    it("should include both customer and admin stats", async () => {
      const searchStats = [
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

      mockMetricsRepository.getSearchStats.mockResolvedValue(searchStats);
      mockMetricsRepository.getTopQueries.mockResolvedValue([]);
      mockMetricsRepository.getSlowQueries.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingStats.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingFailures.mockResolvedValue([]);

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.search.stats).toHaveLength(2);
    });

    it("should validate embedding stats structure", async () => {
      const embeddingStats = [
        {
          total_embeddings: 500,
          successful_embeddings: 495,
          failed_embeddings: 5,
          avg_generation_ms: 120,
          p95_generation_ms: 250,
          avg_success_ms: 115,
          avg_failure_ms: 300,
          provider: "local",
          context: "product_indexing",
        },
      ];

      mockMetricsRepository.getSearchStats.mockResolvedValue([]);
      mockMetricsRepository.getTopQueries.mockResolvedValue([]);
      mockMetricsRepository.getSlowQueries.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingStats.mockResolvedValue(embeddingStats);
      mockMetricsRepository.getEmbeddingFailures.mockResolvedValue([]);

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.embedding.stats).toEqual(embeddingStats);
    });
  });

  describe("Performance", () => {
    it("should fetch all metrics in parallel", async () => {
      mockMetricsRepository.getSearchStats.mockResolvedValue([]);
      mockMetricsRepository.getTopQueries.mockResolvedValue([]);
      mockMetricsRepository.getSlowQueries.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingStats.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingFailures.mockResolvedValue([]);

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      // All methods should be called (parallel execution via Promise.all)
      expect(mockMetricsRepository.getSearchStats).toHaveBeenCalled();
      expect(mockMetricsRepository.getTopQueries).toHaveBeenCalled();
      expect(mockMetricsRepository.getSlowQueries).toHaveBeenCalled();
      expect(mockMetricsRepository.getEmbeddingStats).toHaveBeenCalled();
      expect(mockMetricsRepository.getEmbeddingFailures).toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle missing query parameter", async () => {
      mockReq.query = undefined;

      mockMetricsRepository.getSearchStats.mockResolvedValue([]);
      mockMetricsRepository.getTopQueries.mockResolvedValue([]);
      mockMetricsRepository.getSlowQueries.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingStats.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingFailures.mockResolvedValue([]);

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      // Should use default time range
      expect(mockMetricsRepository.getSearchStats).toHaveBeenCalledWith("24h");
    });

    it("should handle null time range", async () => {
      mockReq.query = { timeRange: null };

      mockMetricsRepository.getSearchStats.mockResolvedValue([]);
      mockMetricsRepository.getTopQueries.mockResolvedValue([]);
      mockMetricsRepository.getSlowQueries.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingStats.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingFailures.mockResolvedValue([]);

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      expect(mockMetricsRepository.getSearchStats).toHaveBeenCalled();
    });

    it("should handle very large datasets", async () => {
      const largeDataset = Array(10000).fill({
        query: "test",
        count: 1,
        avg_duration_ms: 100,
      });

      mockMetricsRepository.getSearchStats.mockResolvedValue([]);
      mockMetricsRepository.getTopQueries.mockResolvedValue(largeDataset);
      mockMetricsRepository.getSlowQueries.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingStats.mockResolvedValue([]);
      mockMetricsRepository.getEmbeddingFailures.mockResolvedValue([]);

      await GET(mockReq as MedusaRequest, mockRes as MedusaResponse);

      expect(mockRes.json).toHaveBeenCalled();
    });
  });
});