/**
 * Unit Tests for Get Product Data Step
 *
 * This test suite validates the get-product-data-step which:
 * 1. Retrieves product information from the database (title, description, categories, tags)
 * 2. Constructs the text that will be embedded by combining product fields
 * 3. Prepares metadata for storage alongside the embedding
 *
 * Key behaviors tested:
 * - Successfully retrieves and formats product data
 * - Handles products with and without descriptions
 * - Includes category information in embedded text
 * - Handles products with tags
 * - Properly formats metadata structure
 * - Throws errors when product is not found
 */

import { getProductDataStep } from "../get-product-data";
import { Modules } from "@medusajs/framework/utils";

const registerGetProductDataTests = () => {

  describe("getProductDataStep", () => {
    let mockContainer: any;
    let mockProductModuleService: any;

    beforeEach(() => {
      // Mock the product module service
      mockProductModuleService = {
        retrieveProduct: jest.fn(),
      };

      // Mock the container
      mockContainer = {
        resolve: jest.fn((module) => {
          if (module === Modules.PRODUCT) {
            return mockProductModuleService;
          }
          throw new Error(`Unknown module: ${module}`);
        }),
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe("Successful product data retrieval", () => {
      it("should retrieve and format product data with all fields", async () => {
        // Arrange
        const mockProduct = {
          id: "prod_123",
          title: "TechPro Wireless Laptop",
          description: "High-performance laptop with 4K display",
          handle: "techpro-wireless-laptop",
          categories: [
            { id: "cat_1", name: "Electronics" },
            { id: "cat_2", name: "Computers" },
          ],
          tags: [
            { id: "tag_1", value: "premium" },
            { id: "tag_2", value: "gaming" },
          ],
          variants: [],
        };

        mockProductModuleService.retrieveProduct.mockResolvedValue(mockProduct);

        // Act
        const result = await getProductDataStep(
          { product_id: "prod_123" },
          { container: mockContainer }
        );

        // Assert
        expect(mockProductModuleService.retrieveProduct).toHaveBeenCalledWith(
          "prod_123",
          {
            relations: ["variants", "categories", "tags"],
          }
        );

        expect(result).toEqual({
          product_id: "prod_123",
          embedded_text:
            "TechPro Wireless Laptop. High-performance laptop with 4K display. Categories: Electronics, Computers",
          metadata: {
            title: "TechPro Wireless Laptop",
            handle: "techpro-wireless-laptop",
            categories: ["Electronics", "Computers"],
            tags: ["premium", "gaming"],
          },
        });
      });

      it("should handle products without description", async () => {
        // Arrange
        const mockProduct = {
          id: "prod_456",
          title: "Elite Gaming Mouse",
          description: null,
          handle: "elite-gaming-mouse",
          categories: [{ id: "cat_1", name: "Accessories" }],
          tags: [],
          variants: [],
        };

        mockProductModuleService.retrieveProduct.mockResolvedValue(mockProduct);

        // Act
        const result = await getProductDataStep(
          { product_id: "prod_456" },
          { container: mockContainer }
        );

        // Assert
        expect(result.embedded_text).toBe(
          "Elite Gaming Mouse. Categories: Accessories"
        );
        expect(result.metadata.title).toBe("Elite Gaming Mouse");
        expect(result.metadata.tags).toEqual([]);
      });

      it("should handle products without categories", async () => {
        // Arrange
        const mockProduct = {
          id: "prod_789",
          title: "Smart Watch",
          description: "Track your fitness goals",
          handle: "smart-watch",
          categories: [],
          tags: [],
          variants: [],
        };

        mockProductModuleService.retrieveProduct.mockResolvedValue(mockProduct);

        // Act
        const result = await getProductDataStep(
          { product_id: "prod_789" },
          { container: mockContainer }
        );

        // Assert
        expect(result.embedded_text).toBe(
          "Smart Watch. Track your fitness goals"
        );
        expect(result.metadata).toEqual({
          title: "Smart Watch",
          handle: "smart-watch",
        });
      });

      it("should handle products with only title", async () => {
        // Arrange
        const mockProduct = {
          id: "prod_minimal",
          title: "Basic Product",
          description: "",
          handle: "basic-product",
          categories: null,
          tags: null,
          variants: [],
        };

        mockProductModuleService.retrieveProduct.mockResolvedValue(mockProduct);

        // Act
        const result = await getProductDataStep(
          { product_id: "prod_minimal" },
          { container: mockContainer }
        );

        // Assert
        expect(result.embedded_text).toBe("Basic Product");
        expect(result.metadata).toEqual({
          title: "Basic Product",
          handle: "basic-product",
        });
      });
    });

    describe("Error handling", () => {
      it("should throw error when product is not found", async () => {
        // Arrange
        mockProductModuleService.retrieveProduct.mockRejectedValue(
          new Error("Product with id: prod_notfound was not found")
        );

        // Act & Assert
        await expect(
          getProductDataStep(
            { product_id: "prod_notfound" },
            { container: mockContainer }
          )
        ).rejects.toThrow("Product with id: prod_notfound was not found");
      });

      it("should throw error when database connection fails", async () => {
        // Arrange
        mockProductModuleService.retrieveProduct.mockRejectedValue(
          new Error("Database connection failed")
        );

        // Act & Assert
        await expect(
          getProductDataStep(
            { product_id: "prod_123" },
            { container: mockContainer }
          )
        ).rejects.toThrow("Database connection failed");
      });
    });

    describe("Edge cases", () => {
      it("should handle products with multiple categories", async () => {
        // Arrange
        const mockProduct = {
          id: "prod_multi",
          title: "Multi-Category Product",
          description: "Versatile product",
          handle: "multi-category",
          categories: [
            { id: "cat_1", name: "Electronics" },
            { id: "cat_2", name: "Computers" },
            { id: "cat_3", name: "Gaming" },
            { id: "cat_4", name: "Premium" },
          ],
          tags: [],
          variants: [],
        };

        mockProductModuleService.retrieveProduct.mockResolvedValue(mockProduct);

        // Act
        const result = await getProductDataStep(
          { product_id: "prod_multi" },
          { container: mockContainer }
        );

        // Assert
        expect(result.embedded_text).toContain(
          "Categories: Electronics, Computers, Gaming, Premium"
        );
        expect(result.metadata.categories).toHaveLength(4);
      });

      it("should handle special characters in product data", async () => {
        // Arrange
        const mockProduct = {
          id: "prod_special",
          title: "Product & Special <Characters>",
          description: 'Description with "quotes" and symbols: @#$%',
          handle: "product-special-characters",
          categories: [{ id: "cat_1", name: "Category & More" }],
          tags: [{ id: "tag_1", value: "tag-with-dash" }],
          variants: [],
        };

        mockProductModuleService.retrieveProduct.mockResolvedValue(mockProduct);

        // Act
        const result = await getProductDataStep(
          { product_id: "prod_special" },
          { container: mockContainer }
        );

        // Assert
        expect(result.embedded_text).toContain("Product & Special <Characters>");
        expect(result.embedded_text).toContain('Description with "quotes"');
        expect(result.metadata.categories).toContain("Category & More");
      });
    });
  });
};

if (typeof jest !== "undefined" && typeof describe === "function") {
  registerGetProductDataTests();
}

