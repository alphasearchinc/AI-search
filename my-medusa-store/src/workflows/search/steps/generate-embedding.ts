import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { embedText, EmbeddingResult } from "../../../lib/embedding-client";

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
    
    try {
      const embedding = await embedText(query);
      const duration = Date.now() - startTime;
      
      return new StepResponse({
        embedding,
        mode: "hybrid",
        duration,
      } as GenerateEmbeddingOutput);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.warn(
        `[Generate Embedding Step] Embedding unavailable, falling back to BM25-only: ${error.message}`
      );
      return new StepResponse({
        embedding: { vectors: [], dimensions: 0 },
        mode: "bm25-only",
        duration,
      } as GenerateEmbeddingOutput);
    }
  }
);
