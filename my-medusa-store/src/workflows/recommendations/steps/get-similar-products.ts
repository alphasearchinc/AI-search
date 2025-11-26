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

    const client = elasticsearchService.getClient();
    const indexName = elasticsearchService.PRODUCT_EMBEDDINGS_INDEX;

    const searchResponse = await client.search({
      index: indexName,
      size: input.limit + 1,
      knn: {
        field: "embedding",
        query_vector: input.embedding,
        k: input.limit + 1,
        num_candidates: Math.max(input.limit * 2, 50),
      },
      _source: ["product_id", "embedded_text", "metadata", "generated_at"],
    });

    const allHits = searchResponse.hits.hits.map((hit) => {
      const source = hit._source as any;
      return {
        id: hit._id as string,
        product_id: source.product_id,
        score: hit._score || 0,
        vector_score: hit._score || 0,
        confidence: hit._score ? Math.min(hit._score, 1) : 0,
        embedded_text: source.embedded_text,
        metadata: source.metadata,
        generated_at: source.generated_at,
      };
    });

    const recommendations = allHits
      .filter((hit) => hit.product_id !== input.productId)
      .slice(0, input.limit);

    logger.info(
      `[Recommendations] Found ${recommendations.length} similar products for ${input.productId}`
    );

    return new StepResponse({
      product_id: input.productId,
      hits: recommendations,
      count: recommendations.length,
      searchDuration: searchResponse.took || 0,
    });
  }
);