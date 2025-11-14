const DEFAULT_EMBEDDING_SERVICE_URL =
  process.env.EMBEDDING_SERVICE_URL || "http://localhost:1337";
const DEFAULT_TIMEOUT_MS = 10000;

export type EmbeddingResult = {
  embedding: number[];
  dimensions: number;
};

export const getEmbeddingServiceUrl = (): string =>
  DEFAULT_EMBEDDING_SERVICE_URL;

export async function embedText(
  text: string,
  options?: {
    timeoutMs?: number;
  }
): Promise<EmbeddingResult> {
  if (!text?.trim()) {
    throw new Error("Text must be provided to generate an embedding");
  }

  const embeddingServiceUrl = getEmbeddingServiceUrl();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let response;

  try {
    response = await fetch(`${embeddingServiceUrl}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: any) {
    throw new Error(
      `Failed to reach embedding service at ${embeddingServiceUrl}: ${error.message}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Embedding service responded with HTTP ${response.status} (${response.statusText})`
    );
  }

  let data: any;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Embedding service returned invalid JSON");
  }

  // Extract from nested structure: data.embedding.vectors and data.embedding.dimensions
  const embeddingData = data?.embedding;
  if (!embeddingData || typeof embeddingData !== 'object') {
    throw new Error("Embedding service returned an invalid response structure");
  }

  const embedding = embeddingData.vectors;
  if (
    !Array.isArray(embedding) ||
    embedding.some((value) => typeof value !== "number")
  ) {
    throw new Error("Embedding service returned an invalid embedding format");
  }

  const dimensions =
    typeof embeddingData.dimensions === "number"
      ? embeddingData.dimensions
      : embedding.length;

  return {
    embedding,
    dimensions,
  };
}