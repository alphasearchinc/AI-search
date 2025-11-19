import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { embedText } from "../../../lib/embedding-client";

type GenerateQueryEmbeddingInput = {
  query: string;
};

type GenerateQueryEmbeddingOutput = {
  embedding: { vectors: number[]; dimensions: number };
  mode: "hybrid" | "bm25-only";
};

/**
 * Step to generate embedding for a search query.
 * Falls back to BM25-only mode if embedding service is unavailable.
 */
export const generateQueryEmbeddingStep = createStep(
  "generate-query-embedding",
  async (input: GenerateQueryEmbeddingInput, { container }) => {
    const logger = container.resolve("logger");
    const { query } = input;

    try {
      const embedding = await embedText(query);

      logger.debug(
        `[Search] Generated embedding for query: "${query.slice(0, 50)}..."`
      );

      return new StepResponse({
        embedding,
        mode: "hybrid" as const,
      });
    } catch (error: any) {
      logger.warn(
        `[Search] Embedding unavailable, falling back to BM25-only: ${error.message}`
      );

      // Return dummy embedding for BM25-only mode
      return new StepResponse({
        embedding: { vectors: [], dimensions: 0 },
        mode: "bm25-only" as const,
      });
    }
  }
);
