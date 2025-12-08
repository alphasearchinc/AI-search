import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { embedText, EmbeddingResult } from "../../../lib/embedding-client";
import { metricsRepository } from "../../../lib/metrics-repository";

type GenerateEmbeddingInput = {
  query: string;
};

export type GenerateEmbeddingOutput = {
  embedding: EmbeddingResult;
  mode: "hybrid" | "bm25-only";
  duration: number;
};

export const generateEmbeddingStep = createStep(
  "generate-embedding-step",
  async ({ query }: GenerateEmbeddingInput, { container }) => {
    const logger = container.resolve("logger");
    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;
    let embedding: EmbeddingResult | undefined;

    try {
      embedding = await embedText(query);
      success = true;
      const duration = Date.now() - startTime;

      // Record success metrics
      metricsRepository.recordEmbedding({
        product_id: null,
        query,
        generation_ms: duration,
        embedding_dimensions: embedding.dimensions,
        success: true,
        provider: process.env.LOCAL_EMBEDDING_SERVICE_URL ? 'local' : 'openai',
        context: 'search_query'
      }).catch(err => {
        logger.error('[METRICS] Failed to record embedding metric:', err);
      });

      return new StepResponse({
        embedding,
        mode: "hybrid",
        duration,
      } as GenerateEmbeddingOutput);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      errorMessage = error.message;
      
      logger.warn(
        `[Generate Embedding Step] Embedding unavailable, falling back to BM25-only: ${error.message}`
      );

      // Record failure metrics
      metricsRepository.recordEmbedding({
        product_id: null,
        query,
        generation_ms: duration,
        embedding_dimensions: 0,
        success: false,
        error_message: errorMessage,
        provider: process.env.LOCAL_EMBEDDING_SERVICE_URL ? 'local' : 'openai',
        context: 'search_query'
      }).catch(err => {
        logger.error('[METRICS] Failed to record embedding metric:', err);
      });

      return new StepResponse({
        embedding: { vectors: [], dimensions: 0 },
        mode: "bm25-only",
        duration,
      } as GenerateEmbeddingOutput);
    }
  }
);
