import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { embedText } from "../../../lib/embedding-client";

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

    const embeddingSource = process.env.LOCAL_EMBEDDING_SERVICE_URL
      ? `local service at ${process.env.LOCAL_EMBEDDING_SERVICE_URL}`
      : "OpenAI API";

    console.log(
      `🔗 Calling ${embeddingSource} to embed product text...`
    );

    try {
      const { embedding } = await embedText(text);

      console.log(
        `✅ Generated semantic embedding with ${embedding.dimensions} dimensions`
      );

      return new StepResponse({
        embedding,
      });
    } catch (error: any) {
      console.error(
        `❌ Failed to generate embedding from ${embeddingSource}:`,
        error.message
      );

      throw new Error(
        `Embedding service unavailable: ${error.message}`
      );
    }
  }
);
