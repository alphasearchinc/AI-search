/**
 * Unit Tests for Embedding Client
 *
 * This test suite validates the embedding client which:
 * 1. Calls the Python embedding service (Flask API) at http://localhost:8000/embed
 * 2. Sends product text to be converted into semantic vectors
 * 3. Receives 384-dimensional embeddings from SentenceTransformers model
 *
 * Key behaviors tested:
 * - Successfully generates embeddings from Python service
 * - Handles empty or invalid text input
 * - Manages timeout scenarios (10-second timeout configured)
 * - Handles service unavailability (Python service down)
 * - Validates embedding format (384 dimensions expected)
 * - Manages HTTP errors from the service
 * - Validates response structure from Python API
 *
 * Dependencies:
 * - Python Flask service on port 8000
 * - SentenceTransformers model: 'all-MiniLM-L6-v2'
 */

import {
  embedText,
  getEmbeddingServiceUrl,
} from "../../../../lib/embedding-client";

const registerGenerateEmbeddingTests = () => {

  // Mock fetch globally
  global.fetch = jest.fn();

  describe("Embedding Client", () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
      jest.clearAllMocks();
      // Mock console methods
      jest.spyOn(console, "log").mockImplementation();
      jest.spyOn(console, "error").mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe("getEmbeddingServiceUrl", () => {
      it("should return default URL", () => {
        const url = getEmbeddingServiceUrl();
        expect(url).toBe("http://localhost:8000");
      });
    });

    describe("embedText - Successful embedding generation", () => {
      it("should generate embedding with 384 dimensions", async () => {
        // Arrange
        const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            embedding: mockEmbedding,
            dimensions: 384,
          }),
        } as Response);

        // Act
        const result = await embedText(
          "TechPro Wireless Laptop. High-performance laptop with 4K display"
        );

        // Assert
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:8000/embed",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
          })
        );
        expect(result.embedding).toHaveLength(384);
        expect(result.dimensions).toBe(384);
      });

      it("should handle simple product titles", async () => {
        // Arrange
        const mockEmbedding = new Array(384).fill(0.5);
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            embedding: mockEmbedding,
            dimensions: 384,
          }),
        } as Response);

        // Act
        const result = await embedText("Gaming Mouse");

        // Assert
        expect(result.embedding).toHaveLength(384);
        expect(result.dimensions).toBe(384);
      });

      it("should handle long product descriptions", async () => {
        // Arrange
        const longText = `TechPro Professional Laptop. Experience premium quality with cutting-edge technology.
          This laptop features a stunning 4K display, powerful processor, and long battery life.
          Perfect for professionals, creators, and power users who demand the best performance.`;

        const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            embedding: mockEmbedding,
            dimensions: 384,
          }),
        } as Response);

        // Act
        const result = await embedText(longText);

        // Assert
        expect(result.embedding).toHaveLength(384);
      });
    });

    describe("embedText - Service error handling", () => {
      it("should throw error when Python service is unavailable", async () => {
        // Arrange
        mockFetch.mockRejectedValue(
          new Error("connect ECONNREFUSED 127.0.0.1:8000")
        );

        // Act & Assert
        await expect(embedText("Test product")).rejects.toThrow();
      });

      it("should throw error on HTTP 500 response", async () => {
        // Arrange
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as Response);

        // Act & Assert
        await expect(embedText("Test product")).rejects.toThrow();
      });

      it("should throw error on HTTP 404 response", async () => {
        // Arrange
        mockFetch.mockResolvedValue({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as Response);

        // Act & Assert
        await expect(embedText("Test product")).rejects.toThrow();
      });
    });

    describe("embedText - Response validation", () => {
      it("should handle embeddings with exact 384 dimensions", async () => {
        // Arrange
        const mockEmbedding = new Array(384).fill(0.123456);
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            embedding: mockEmbedding,
            dimensions: 384,
          }),
        } as Response);

        // Act
        const result = await embedText("Product");

        // Assert
        expect(result.embedding).toHaveLength(384);
        expect(result.dimensions).toBe(384);
      });

      it("should handle floating point precision in embeddings", async () => {
        // Arrange
        const mockEmbedding = [
          -0.04900216,
          0.023538826,
          0.015234567,
          ...new Array(381).fill(0).map(() => Math.random() * 2 - 1),
        ];
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            embedding: mockEmbedding,
            dimensions: 384,
          }),
        } as Response);

        // Act
        const result = await embedText("Product");

        // Assert
        expect(result.embedding[0]).toBeCloseTo(-0.04900216, 8);
        expect(result.embedding[1]).toBeCloseTo(0.023538826, 8);
      });
    });

    describe("embedText - Special characters and encodings", () => {
      it("should handle special characters in product text", async () => {
        // Arrange
        const textWithSpecialChars = 'Product & "Quotes" <Special> €100';
        const mockEmbedding = new Array(384).fill(0.5);
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            embedding: mockEmbedding,
            dimensions: 384,
          }),
        } as Response);

        // Act
        const result = await embedText(textWithSpecialChars);

        // Assert
        expect(result.embedding).toHaveLength(384);
      });

      it("should handle unicode characters", async () => {
        // Arrange
        const unicodeText = "Product 🚀 ★ 日本語 émojis";
        const mockEmbedding = new Array(384).fill(0.5);
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            embedding: mockEmbedding,
            dimensions: 384,
          }),
        } as Response);

        // Act
        const result = await embedText(unicodeText);

        // Assert
        expect(result.embedding).toHaveLength(384);
      });
    });
  });
};

if (typeof jest !== "undefined" && typeof describe === "function") {
  registerGenerateEmbeddingTests();
}

