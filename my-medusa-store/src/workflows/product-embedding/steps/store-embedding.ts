import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { PRODUCT_EMBEDDING_MODULE } from "../../../modules/product-embedding";
import ProductEmbeddingService from "../../../modules/product-embedding/service";

type StoreEmbeddingInput = {
  product_id: string;
  embedding_vector: number[];
  embedded_text: string;
  metadata?: Record<string, any>;
};

export const storeEmbeddingStep = createStep(
  "store-embedding-step",
  async (input: StoreEmbeddingInput, { container }) => {
    const embeddingService: ProductEmbeddingService = container.resolve(
      PRODUCT_EMBEDDING_MODULE
    );

    // Check if embedding already exists
    const existingEmbedding = await embeddingService.getEmbeddingByProductId(
      input.product_id
    );

    let embedding;
    if (existingEmbedding) {
      // Update existing embedding
      embedding = await embeddingService.updateEmbedding(
        (existingEmbedding as any).id,
        {
          embedding_vector: input.embedding_vector,
          embedded_text: input.embedded_text,
          metadata: input.metadata,
        }
      );
    } else {
      // Create new embedding
      embedding = await embeddingService.createEmbedding({
        product_id: input.product_id,
        embedding_vector: input.embedding_vector,
        embedded_text: input.embedded_text,
        metadata: input.metadata,
      });
    }

    return new StepResponse(embedding, {
      product_id: input.product_id,
      embedding_id: (embedding as any).id,
    });
  },
  async (compensateData, { container }) => {
    if (!compensateData) return;

    const embeddingService: ProductEmbeddingService = container.resolve(
      PRODUCT_EMBEDDING_MODULE
    );

    // Rollback: Delete the embedding if something goes wrong
    await embeddingService.deleteEmbeddingByProductId(
      compensateData.product_id
    );
  }
);
