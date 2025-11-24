import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ELASTICSEARCH_MODULE } from "../../../modules/elasticsearch";
import ElasticsearchModuleService from "../../../modules/elasticsearch/services/main";

type StoreEmbeddingInput = {
  product_id: string;
  embedding: {
    vectors: number[];
    dimensions: number;
  };
  embedded_text: string;
  metadata?: Record<string, any>;
};

export const storeEmbeddingStep = createStep(
  "store-embedding-step",
  async (input: StoreEmbeddingInput, { container }) => {
    const elasticsearchService: ElasticsearchModuleService = container.resolve(
      ELASTICSEARCH_MODULE
    );

    await elasticsearchService.queueEmbedding({
      product_id: input.product_id,
      embedding: input.embedding,
      embedded_text: input.embedded_text,
      metadata: input.metadata,
    });

    return new StepResponse(
      {
        product_id: input.product_id,
      },
      {
        product_id: input.product_id,
      }
    );
  }
);
