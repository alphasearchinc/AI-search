import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

type GenerateEmbeddingInput = {
  text: string;
};

export const generateEmbeddingStep = createStep(
  "generate-embedding-step",
  async (input: GenerateEmbeddingInput) => {
    // Get embedding service URL from environment or use default
    const embeddingServiceUrl =
      process.env.EMBEDDING_SERVICE_URL || "http://localhost:8000";

    console.log(
      `🔗 Calling Python embedding service at ${embeddingServiceUrl}...`
    );

    try {
      // Call Python embedding service
      const response = await fetch(`${embeddingServiceUrl}/embed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: input.text,
        }),
        // Add timeout to fail fast if service is down
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error("Invalid response format from embedding service");
      }

      console.log(
        `✅ Generated semantic embedding with ${data.dimensions} dimensions`
      );

      return new StepResponse({
        embedding_vector: data.embedding,
        dimensions: data.dimensions,
      });
    } catch (error: any) {
      console.error(
        "❌ Failed to generate embedding from Python service:",
        error.message
      );

      // Re-throw the error instead of using fallback
      // This ensures you know when the embedding service is down
      throw new Error(
        `Embedding service unavailable: ${error.message}. ` +
          `Please ensure the Python embedding service is running at ${embeddingServiceUrl}`
      );
    }
  }
);
