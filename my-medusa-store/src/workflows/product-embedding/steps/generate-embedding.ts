import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  embedText,
  getEmbeddingServiceUrl,
} from "../../../lib/embedding-client";

type GenerateEmbeddingInput = {
  text: string;
};

export const generateEmbeddingStep = createStep(
  "generate-embedding-step",
  async (input: GenerateEmbeddingInput) => {
    const text = input.text?.trim();
    if (!text) {
      throw new Error("No text provided for embedding generation");
    }

    const embeddingServiceUrl = getEmbeddingServiceUrl();
    console.log(
      `🔗 Calling Python embedding service at ${embeddingServiceUrl} to embed product text...`
    );

    try {
      const { embedding, dimensions } = await embedText(text);

      console.log(
        `✅ Generated semantic embedding with ${dimensions} dimensions`
      );

      return new StepResponse({
        embedding_vector: embedding,
        dimensions,
      });
    } catch (error: any) {
      console.error(
        "❌ Failed to generate embedding from Python service:",
        error.message
      );

      throw new Error(
        `Embedding service unavailable: ${error.message}. Please ensure the Python embedding service is running at ${embeddingServiceUrl}.`
      );
    }
  }
);
