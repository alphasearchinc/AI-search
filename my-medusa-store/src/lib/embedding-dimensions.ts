import { embedText } from "./embedding-client";

export async function detectEmbeddingDimensions(): Promise<number> {
  try {
    const testEmbedding = await embedText("test", { timeoutMs: 5000 });
    return testEmbedding.dimensions;
  } catch (error: any) {
    throw new Error(
      `Cannot detect embedding dimensions: ${error.message}. ` +
      `Ensure embedding service (local or OpenAI) is available.`
    );
  }
}