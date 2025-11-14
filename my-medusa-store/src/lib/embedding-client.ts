const DEFAULT_EMBEDDING_SERVICE_URL =
  process.env.EMBEDDING_SERVICE_URL || "http://localhost:1337";
const DEFAULT_TIMEOUT_MS = 10000;

export type EmbeddingResult = {
  embedding: {
    vectors: number[];
    dimensions: number;
  };
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

  // Validate the nested structure
  const embeddingData = data?.embedding;
  if (!embeddingData || typeof embeddingData !== 'object') {
    throw new Error("Embedding service returned an invalid response structure");
  }

  const vectors = embeddingData.vectors;
  if (
    !Array.isArray(vectors) ||
    vectors.some((value) => typeof value !== "number")
  ) {
    throw new Error("Embedding service returned an invalid embedding format");
  }

  if (typeof embeddingData.dimensions !== 'number') {
    throw new Error("Embedding service returned invalid dimensions");
  }

  // Return the entire embedding object as-is
  return {
    embedding: embeddingData
  };
}