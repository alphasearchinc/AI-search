import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

type GenerateEmbeddingInput = {
  text: string;
};

// This is a placeholder step that generates a simple embedding
// Later you can integrate with OpenAI, Cohere, or other embedding services
export const generateEmbeddingStep = createStep(
  "generate-embedding-step",
  async (input: GenerateEmbeddingInput) => {
    // Placeholder: Generate a simple embedding vector
    // In production, you'd call an AI service here (OpenAI, Cohere, etc.)
    const embeddingVector = generateSimpleEmbedding(input.text);

    return new StepResponse({ embedding_vector: embeddingVector });
  }
);

// Simple embedding generator for demonstration
// Replace this with actual AI service call later
function generateSimpleEmbedding(text: string): number[] {
  // Create a deterministic embedding based on text
  // This is just for demonstration - use real embeddings in production
  const words = text.toLowerCase().split(/\s+/);
  const embedding = new Array(384).fill(0); // Common embedding size

  // Simple hash-based embedding (NOT for production)
  words.forEach((word, index) => {
    for (let i = 0; i < word.length; i++) {
      const charCode = word.charCodeAt(i);
      const position = (charCode + index * 7) % 384;
      embedding[position] += 0.1;
    }
  });

  // Normalize
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  );
  return embedding.map((val) => (magnitude > 0 ? val / magnitude : 0));
}
