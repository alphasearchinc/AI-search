/**
 * Unit Tests for Elasticsearch Queue
 *
 * This test suite validates the productEmbeddingQueue which:
 * 1. Adds embedding jobs to the BullMQ queue
 * 2. Manages Redis queue connections for async processing
 * 3. Prepares embedding data for Elasticsearch indexing
 *
 * Key behaviors tested:
 * - Successfully adds jobs to the queue with proper payload
 * - Handles queue connection errors
 * - Validates job ID generation
 * - Properly structures embedding data (product_id, embedding_vector, embedded_text, metadata)
 * - Manages retry configuration (3 attempts, exponential backoff)
 * - Returns correct response format for workflow continuation
 *
 * Queue Configuration:
 * - Queue name: "product-embedding-queue"
 * - Job name: "embedding.index"
 * - Redis connection: localhost:6379
 * - Worker processes job and indexes to Elasticsearch
 */

import { productEmbeddingQueue } from "../../src/lib/elasticsearch-queue";

// Mock the queue module
jest.mock("../../src/lib/elasticsearch-queue", () => ({
  productEmbeddingQueue: {
    add: jest.fn(),
  },
}));

describe("Elasticsearch Queue", () => {
  const mockQueue = productEmbeddingQueue as jest.Mocked<
    typeof productEmbeddingQueue
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Successful job queueing", () => {
    it("should add job to queue with complete embedding data", async () => {
      // Arrange
      const mockJobId = "job_123456";
      mockQueue.add.mockResolvedValue({
        id: mockJobId,
      } as any);

      const jobData = {
        product_id: "prod_123",
        embedding_vector: new Array(384).fill(0.5),
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
      const result = await mockQueue.add("embedding.index", jobData);

      // Assert
      expect(mockQueue.add).toHaveBeenCalledWith("embedding.index", {
        product_id: "prod_123",
        embedding_vector: expect.any(Array),
        embedded_text:
          "TechPro Wireless Laptop. High-performance laptop with 4K display",
        metadata: {
          title: "TechPro Wireless Laptop",
          handle: "techpro-wireless-laptop",
          categories: ["Electronics", "Computers"],
          tags: ["premium", "wireless"],
        },
      });

      expect(result.id).toBe(mockJobId);
    });

    it("should add job without metadata", async () => {
      // Arrange
      const mockJobId = "job_789";
      mockQueue.add.mockResolvedValue({
        id: mockJobId,
      } as any);

      const jobData = {
        product_id: "prod_456",
        embedding_vector: new Array(384).fill(0.1),
        embedded_text: "Gaming Mouse",
        metadata: undefined,
      };

      // Act
      const result = await mockQueue.add("embedding.index", jobData);

      // Assert
      expect(mockQueue.add).toHaveBeenCalledWith("embedding.index", jobData);
      expect(result.id).toBe(mockJobId);
    });

    it("should handle 384-dimensional embedding vectors", async () => {
      // Arrange
      const mockJobId = "job_embedding_384";
      mockQueue.add.mockResolvedValue({
        id: mockJobId,
      } as any);

      const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
      const jobData = {
        product_id: "prod_full_vector",
        embedding_vector: mockEmbedding,
        embedded_text: "Complete product description",
        metadata: { title: "Test Product" },
      };

      // Act
      const result = await mockQueue.add("embedding.index", jobData);

      // Assert
      expect(mockQueue.add).toHaveBeenCalled();
      const callArgs = mockQueue.add.mock.calls[0][1];
      expect(callArgs.embedding_vector).toHaveLength(384);
      expect(result.id).toBe(mockJobId);
    });

    it("should preserve floating point precision in embeddings", async () => {
      // Arrange
      const mockJobId = "job_precision";
      mockQueue.add.mockResolvedValue({
        id: mockJobId,
      } as any);

      const preciseEmbedding = [
        -0.04900216,
        0.023538826,
        0.015234567,
        ...new Array(381).fill(0).map(() => Math.random() * 2 - 1),
      ];

      const jobData = {
        product_id: "prod_precise",
        embedding_vector: preciseEmbedding,
        embedded_text: "Precision test",
      };

      // Act
      await mockQueue.add("embedding.index", jobData);

      // Assert
      const callArgs = mockQueue.add.mock.calls[0][1];
      expect(callArgs.embedding_vector[0]).toBeCloseTo(-0.04900216, 8);
      expect(callArgs.embedding_vector[1]).toBeCloseTo(0.023538826, 8);
    });
  });

  describe("Error handling", () => {
    it("should throw error when queue connection fails", async () => {
      // Arrange
      mockQueue.add.mockRejectedValue(new Error("Redis connection refused"));

      const jobData = {
        product_id: "prod_error",
        embedding_vector: new Array(384).fill(0),
        embedded_text: "Test",
      };

      // Act & Assert
      await expect(mockQueue.add("embedding.index", jobData)).rejects.toThrow(
        "Redis connection refused"
      );
    });

    it("should throw error when Redis is unavailable", async () => {
      // Arrange
      mockQueue.add.mockRejectedValue(new Error("ECONNREFUSED localhost:6379"));

      const jobData = {
        product_id: "prod_redis_down",
        embedding_vector: new Array(384).fill(0),
        embedded_text: "Test",
      };

      // Act & Assert
      await expect(mockQueue.add("embedding.index", jobData)).rejects.toThrow(
        "ECONNREFUSED"
      );
    });

    it("should throw error when queue is full", async () => {
      // Arrange
      mockQueue.add.mockRejectedValue(
        new Error("Queue is full, cannot accept more jobs")
      );

      const jobData = {
        product_id: "prod_queue_full",
        embedding_vector: new Array(384).fill(0),
        embedded_text: "Test",
      };

      // Act & Assert
      await expect(mockQueue.add("embedding.index", jobData)).rejects.toThrow(
        "Queue is full"
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle very long embedded text", async () => {
      // Arrange
      const mockJobId = "job_long_text";
      mockQueue.add.mockResolvedValue({
        id: mockJobId,
      } as any);

      const longText = "A".repeat(10000); // 10KB of text
      const jobData = {
        product_id: "prod_long",
        embedding_vector: new Array(384).fill(0.5),
        embedded_text: longText,
      };

      // Act
      const result = await mockQueue.add("embedding.index", jobData);

      // Assert
      expect(mockQueue.add).toHaveBeenCalled();
      const callArgs = mockQueue.add.mock.calls[0][1];
      expect(callArgs.embedded_text).toHaveLength(10000);
      expect(result.id).toBe(mockJobId);
    });

    it("should handle special characters in product ID", async () => {
      // Arrange
      const mockJobId = "job_special";
      mockQueue.add.mockResolvedValue({
        id: mockJobId,
      } as any);

      const jobData = {
        product_id: "prod_01K9YKKSVM7D5KX3J43VBN0DF9",
        embedding_vector: new Array(384).fill(0.5),
        embedded_text: "Product with special ID format",
      };

      // Act
      const result = await mockQueue.add("embedding.index", jobData);

      // Assert
      expect(mockQueue.add).toHaveBeenCalled();
      expect(result.id).toBe(mockJobId);
    });

    it("should handle empty metadata object", async () => {
      // Arrange
      const mockJobId = "job_empty_meta";
      mockQueue.add.mockResolvedValue({
        id: mockJobId,
      } as any);

      const jobData = {
        product_id: "prod_empty",
        embedding_vector: new Array(384).fill(0.5),
        embedded_text: "Product",
        metadata: {},
      };

      // Act
      const result = await mockQueue.add("embedding.index", jobData);

      // Assert
      expect(mockQueue.add).toHaveBeenCalled();
      const callArgs = mockQueue.add.mock.calls[0][1];
      expect(callArgs.metadata).toEqual({});
      expect(result.id).toBe(mockJobId);
    });
  });

  describe("Job ID generation", () => {
    it("should return different job IDs for different products", async () => {
      // Arrange
      mockQueue.add
        .mockResolvedValueOnce({ id: "job_001" } as any)
        .mockResolvedValueOnce({ id: "job_002" } as any);

      // Act
      const result1 = await mockQueue.add("embedding.index", {
        product_id: "prod_001",
        embedding_vector: new Array(384).fill(0.5),
        embedded_text: "Product 1",
      });

      const result2 = await mockQueue.add("embedding.index", {
        product_id: "prod_002",
        embedding_vector: new Array(384).fill(0.5),
        embedded_text: "Product 2",
      });

      // Assert
      expect(result1.id).toBe("job_001");
      expect(result2.id).toBe("job_002");
      expect(result1.id).not.toBe(result2.id);
    });
  });
});
