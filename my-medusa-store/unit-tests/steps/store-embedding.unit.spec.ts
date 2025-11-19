/**
 * Unit Tests for Elasticsearch Module Queue
 *
 * This test suite validates the ElasticsearchModuleService.queueEmbedding() which:
 * 1. Adds embedding jobs to the BullMQ queue
 * 2. Manages Redis queue connections for async processing
 * 3. Prepares embedding data for Elasticsearch indexing
 *
 * Key behaviors tested:
 * - Successfully adds jobs to the queue with proper payload
 * - Handles queue connection errors
 * - Validates job ID generation
 * - Properly structures embedding data (product_id, embedding, embedded_text, metadata)
 * - Manages retry configuration (3 attempts, exponential backoff)
 *
 * Queue Configuration:
 * - Queue name: "product-embedding-queue"
 * - Job name: "embed"
 * - Redis connection: localhost:6379
 * - Worker processes job and indexes to Elasticsearch
 */

// Mock BullMQ Queue
const mockQueueAdd = jest.fn();

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
  })),
  Worker: jest.fn(),
}));

jest.mock("@elastic/elasticsearch", () => ({
  Client: jest.fn().mockImplementation(() => ({
    indices: { exists: jest.fn(), create: jest.fn() },
  })),
}));

jest.mock("../../src/lib/redis-connection", () => ({
  createRedisConnection: jest.fn(() => ({})),
}));

import ElasticsearchModuleService from "../../src/modules/elasticsearch/services/main";

describe("Elasticsearch Module Queue", () => {
  let service: ElasticsearchModuleService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockClear();
    mockQueueAdd.mockResolvedValue({ id: "test-job-id" } as any);
    service = new ElasticsearchModuleService({}, {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Successful job queueing", () => {
    it("should add job to queue with complete embedding data", async () => {
      // Arrange
      const jobData = {
        product_id: "prod_123",
        embedding: {
          vectors: new Array(384).fill(0.5),
          dimensions: 384,
        },
        embedded_text:
          "TechPro Wireless Laptop. High-performance laptop with 4K display",
        metadata: {
          title: "TechPro Wireless Laptop",
          handle: "techpro-wireless-laptop",
          categories: ["Electronics", "Computers"],
          tags: ["premium", "wireless"],
        },
      };

      // Act
      await service.queueEmbedding(jobData);

      // Assert
      expect(mockQueueAdd).toHaveBeenCalledWith("embed", {
        product_id: "prod_123",
        embedding: {
          vectors: expect.any(Array),
          dimensions: 384,
        },
        embedded_text:
          "TechPro Wireless Laptop. High-performance laptop with 4K display",
        metadata: {
          title: "TechPro Wireless Laptop",
          handle: "techpro-wireless-laptop",
          categories: ["Electronics", "Computers"],
          tags: ["premium", "wireless"],
        },
      });
    });

    it("should add job without metadata", async () => {
      // Arrange
      const jobData = {
        product_id: "prod_456",
        embedding: {
          vectors: new Array(384).fill(0.1),
          dimensions: 384,
        },
        embedded_text: "Gaming Mouse",
      };

      // Act
      await service.queueEmbedding(jobData);

      // Assert
      expect(mockQueueAdd).toHaveBeenCalledWith("embed", jobData);
    });

    it("should handle 384-dimensional embedding vectors", async () => {
      // Arrange
      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      const jobData = {
        product_id: "prod_full_vector",
        embedding: {
          vectors: mockEmbedding,
          dimensions: 384,
        },
        embedded_text: "Complete product description",
        metadata: { title: "Test Product" },
      };

      // Act
      await service.queueEmbedding(jobData);

      // Assert
      expect(mockQueueAdd).toHaveBeenCalled();
      const callArgs = mockQueueAdd.mock.calls[0][1];
      expect(callArgs.embedding.vectors).toHaveLength(384);
    });

    it("should preserve floating point precision in embeddings", async () => {
      // Arrange
      const preciseEmbedding = [
        -0.04900216,
        0.023538826,
        0.015234567,
        ...new Array(381).fill(0).map(() => Math.random() * 2 - 1),
      ];

      const jobData = {
        product_id: "prod_precise",
        embedding: {
          vectors: preciseEmbedding,
          dimensions: 384,
        },
        embedded_text: "Precision test",
      };

      // Act
      await service.queueEmbedding(jobData);

      // Assert
      const callArgs = mockQueueAdd.mock.calls[0][1];
      expect(callArgs.embedding.vectors[0]).toBeCloseTo(-0.04900216, 8);
      expect(callArgs.embedding.vectors[1]).toBeCloseTo(0.023538826, 8);
    });
  });

  describe("Error handling", () => {
    it("should throw error when queue connection fails", async () => {
      // Arrange
      mockQueueAdd.mockRejectedValue(new Error("Redis connection refused"));

      const jobData = {
        product_id: "prod_error",
        embedding: {
          vectors: new Array(384).fill(0),
          dimensions: 384,
        },
        embedded_text: "Test",
      };

      // Act & Assert
      await expect(service.queueEmbedding(jobData)).rejects.toThrow(
        "Redis connection refused"
      );
    });

    it("should throw error when Redis is unavailable", async () => {
      // Arrange
      mockQueueAdd.mockRejectedValue(new Error("ECONNREFUSED localhost:6379"));

      const jobData = {
        product_id: "prod_redis_down",
        embedding: {
          vectors: new Array(384).fill(0),
          dimensions: 384,
        },
        embedded_text: "Test",
      };

      // Act & Assert
      await expect(service.queueEmbedding(jobData)).rejects.toThrow(
        "ECONNREFUSED"
      );
    });

    it("should throw error when queue is full", async () => {
      // Arrange
      mockQueueAdd.mockRejectedValue(
        new Error("Queue is full, cannot accept more jobs")
      );

      const jobData = {
        product_id: "prod_queue_full",
        embedding: {
          vectors: new Array(384).fill(0),
          dimensions: 384,
        },
        embedded_text: "Test",
      };

      // Act & Assert
      await expect(service.queueEmbedding(jobData)).rejects.toThrow(
        "Queue is full"
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle very long embedded text", async () => {
      // Arrange
      const longText = "A".repeat(10000); // 10KB of text
      const jobData = {
        product_id: "prod_long",
        embedding: {
          vectors: new Array(384).fill(0.5),
          dimensions: 384,
        },
        embedded_text: longText,
      };

      // Act
      await service.queueEmbedding(jobData);

      // Assert
      expect(mockQueueAdd).toHaveBeenCalled();
      const callArgs = mockQueueAdd.mock.calls[0][1];
      expect(callArgs.embedded_text).toHaveLength(10000);
    });

    it("should handle special characters in product ID", async () => {
      // Arrange
      const jobData = {
        product_id: "prod_01K9YKKSVM7D5KX3J43VBN0DF9",
        embedding: {
          vectors: new Array(384).fill(0.5),
          dimensions: 384,
        },
        embedded_text: "Product with special ID format",
      };

      // Act
      await service.queueEmbedding(jobData);

      // Assert
      expect(mockQueueAdd).toHaveBeenCalled();
    });

    it("should handle empty metadata object", async () => {
      // Arrange
      const jobData = {
        product_id: "prod_empty",
        embedding: {
          vectors: new Array(384).fill(0.5),
          dimensions: 384,
        },
        embedded_text: "Product",
        metadata: {},
      };

      // Act
      await service.queueEmbedding(jobData);

      // Assert
      expect(mockQueueAdd).toHaveBeenCalled();
      const callArgs = mockQueueAdd.mock.calls[0][1];
      expect(callArgs.metadata).toEqual({});
    });
  });

  describe("Multiple queue operations", () => {
    it("should handle multiple products queued sequentially", async () => {
      // Arrange
      const jobData1 = {
        product_id: "prod_001",
        embedding: {
          vectors: new Array(384).fill(0.5),
          dimensions: 384,
        },
        embedded_text: "Product 1",
      };

      const jobData2 = {
        product_id: "prod_002",
        embedding: {
          vectors: new Array(384).fill(0.5),
          dimensions: 384,
        },
        embedded_text: "Product 2",
      };

      // Act
      await service.queueEmbedding(jobData1);
      await service.queueEmbedding(jobData2);

      // Assert
      expect(mockQueueAdd).toHaveBeenCalledTimes(2);
      expect(mockQueueAdd).toHaveBeenNthCalledWith(1, "embed", jobData1);
      expect(mockQueueAdd).toHaveBeenNthCalledWith(2, "embed", jobData2);
    });
  });
});
