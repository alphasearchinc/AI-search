import OpenAI from "openai";

const DEFAULT_TIMEOUT_MS = 10000;
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

export type EmbeddingResult = {
  vectors: number[];
  dimensions: number;
};

const useLocalEmbedding = !!process.env.LOCAL_EMBEDDING_SERVICE_URL;
const localEmbeddingServiceUrl = process.env.LOCAL_EMBEDDING_SERVICE_URL;

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY environment variable is required when LOCAL_EMBEDDING_SERVICE_URL is not set"
      );
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export const getEmbeddingServiceUrl = (): string => {
  if (!localEmbeddingServiceUrl) {
    throw new Error("Local embedding service URL is not configured");
  }
  return localEmbeddingServiceUrl;
};

async function embedTextWithOpenAI(text: string): Promise<EmbeddingResult> {
  const client = getOpenAIClient();

  try {
    const response = await client.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input: text,
      encoding_format: "float",
    });

    const vectors = response.data[0].embedding;

    return {
      vectors,
      dimensions: vectors.length,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to generate OpenAI embedding: ${error.message || error}`
    );
  }
}

async function embedTextWithLocalService(
  text: string,
  options?: {
    timeoutMs?: number;
  }
): Promise<EmbeddingResult> {
  const embeddingServiceUrl = localEmbeddingServiceUrl;
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
  return embeddingData;
}

export async function embedText(
  text: string,
  options?: {
    timeoutMs?: number;
  }
): Promise<EmbeddingResult> {
  if (!text?.trim()) {
    throw new Error("Text must be provided to generate an embedding");
  }

  if (useLocalEmbedding) {
    return embedTextWithLocalService(text, options);
  } else {
    return embedTextWithOpenAI(text);
  }
}