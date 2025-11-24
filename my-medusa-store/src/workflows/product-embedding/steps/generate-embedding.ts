import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { embedText } from "../../../lib/embedding-client";
import { metricsRepository } from "../../../lib/metrics-repository"

type GenerateEmbeddingInput = {
  product_id: string,
  text: string;
};

export const generateEmbeddingStep = createStep(
  "generate-embedding-step",
  async (input: GenerateEmbeddingInput) => {
    const text = input.text?.trim();
    if (!text) {
      throw new Error("No text provided for embedding generation");
    }

    const embeddingSource = process.env.LOCAL_EMBEDDING_SERVICE_URL
      ? `local service at ${process.env.LOCAL_EMBEDDING_SERVICE_URL}`
      : "OpenAI API";

    console.log(
      `🔗 Calling ${embeddingSource} to embed product text...`
    );

    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;
    let embedding: any;

    try {
      embedding = await embedText(text);
      success = true;

      console.log(
        `✅ Generated semantic embedding with ${embedding.dimensions} dimensions`
      );

      return new StepResponse({
        embedding,
      });
    } catch (error: any) {
      success = false;
      errorMessage = error.message;

      console.error(
        `❌ Failed to generate embedding from ${embeddingSource}:`,
        error.message
      );

      throw new Error(
        `Embedding service unavailable: ${error.message}`
      );
    } finally {
      // Record metrics (non-blocking, fire-and-forget)
      const duration = Date.now() - startTime;
      
      metricsRepository.recordEmbedding({
        product_id: input.product_id || '',
        query: text,
        generation_ms: duration,
        embedding_dimensions: success ? embedding.dimensions : getEmbeddingDimensions(),
        success,
        error_message: errorMessage,
        provider: process.env.LOCAL_EMBEDDING_SERVICE_URL ? 'local' : 'openai',
        context: 'product_indexing'
      }).catch(err => {
        console.error('[METRICS] Failed to record embedding metric:', err);
      });
    }
  }
);