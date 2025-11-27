import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ELASTICSEARCH_MODULE } from "../../../modules/elasticsearch";
import ElasticsearchModuleService from "../../../modules/elasticsearch/services/main";

export const getProductEmbeddingStep = createStep(
  "get-product-embedding",
  async (productId: string, { container }) => {
    const logger = container.resolve("logger");
    const elasticsearchService: ElasticsearchModuleService =
      container.resolve(ELASTICSEARCH_MODULE);

    try {
      const embedding = await elasticsearchService.getProductEmbedding(productId);
      return new StepResponse({ embedding });
    } catch (error: any) {
      if (error.meta?.statusCode === 404) {
        logger.warn(`[Recommendations] Product ${productId} not found in embeddings index`);
        throw new Error(`Product ${productId} not found in embeddings index`);
      }

      logger.error(`[Recommendations] Failed to get embedding for ${productId}`, error);
      throw error;
    }
  }
);