import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ELASTICSEARCH_MODULE } from "../../../modules/elasticsearch";
import ElasticsearchModuleService from "../../../modules/elasticsearch/services/main";

type GetSimilarProductsInput = {
  productId: string;
  embedding: number[];
  limit: number;
};

export const getSimilarProductsStep = createStep(
  "get-similar-products",
  async (input: GetSimilarProductsInput, { container }) => {
    const logger = container.resolve("logger");
    const elasticsearchService: ElasticsearchModuleService =
      container.resolve(ELASTICSEARCH_MODULE);

    const result = await elasticsearchService.findSimilarProducts({
      queryVector: input.embedding,
      limit: input.limit + 1, // Fetch extra to filter source product
      excludeProductId: input.productId,
    });

    // Filter out the source product
    const recommendations = result.hits
      .filter((hit) => hit.product_id !== input.productId)
      .slice(0, input.limit);

    logger.info(
      `[Recommendations] Found ${recommendations.length} similar products for ${input.productId}`
    );

    return new StepResponse({
      product_id: input.productId,
      hits: recommendations,
      count: recommendations.length,
      searchDuration: result.took,
    });
  }
);