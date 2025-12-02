import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ELASTICSEARCH_MODULE } from "../../../modules/elasticsearch";
import ElasticsearchModuleService from "../../../modules/elasticsearch/services/main";

type StoreEmbeddingInput = {
  product_id: string;
  text_to_embed: string;
  metadata?: Record<string, any>;
};

/**
 * Queue an embedding job to BullMQ.
 * 
 * Worker will generate the embedding and index to Elasticsearch.
 */
export const storeEmbeddingStep = createStep(
  "store-embedding-step",
  async (input: StoreEmbeddingInput, { container }) => {
    const elasticsearchService: ElasticsearchModuleService = container.resolve(
      ELASTICSEARCH_MODULE
    );

    await elasticsearchService.queueEmbedding({
      product_id: input.product_id,
      text_to_embed: input.text_to_embed,
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
