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
      // Use direct client.get() with document ID instead of search
      const client = elasticsearchService.getClient();
      const indexName = elasticsearchService.PRODUCT_EMBEDDINGS_INDEX;

      const result = await client.get({
        index: indexName,
        id: productId,
        _source: ["embedding"],
      });

      const embedding = (result._source as any)?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error(`Product ${productId} has no embedding`);
      }

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