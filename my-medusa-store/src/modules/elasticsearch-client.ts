import { Client } from "@elastic/elasticsearch";

const ELASTICSEARCH_URL =
  process.env.ELASTICSEARCH_URL || "http://localhost:9200";

export const PRODUCT_EMBEDDINGS_INDEX = "product-embeddings";
const EMBEDDING_DIMS = 384;

export const elasticsearchClient = new Client({
  node: ELASTICSEARCH_URL,
});

export async function initializeProductEmbeddingIndex(): Promise<void> {
  try {
    const exists = await elasticsearchClient.indices.exists({
      index: PRODUCT_EMBEDDINGS_INDEX,
    });

    if (!exists) {
      await elasticsearchClient.indices.create({
        index: PRODUCT_EMBEDDINGS_INDEX,
        mappings: {
          properties: {
            product_id: { type: "keyword" },
            embedded_text: { type: "text" },
            metadata: { type: "object", dynamic: true },
            generated_at: { type: "date" },
            embedding_vector: {
              type: "dense_vector",
              dims: EMBEDDING_DIMS,
            },
          },
        },
      });

      console.log(
        `[ELASTICSEARCH] ✅ Index "${PRODUCT_EMBEDDINGS_INDEX}" created`
      );
    } else {
      console.log(
        `[ELASTICSEARCH] ✅ Index "${PRODUCT_EMBEDDINGS_INDEX}" already exists`
      );
    }
  } catch (error) {
    console.error(`[ELASTICSEARCH] ❌ Failed to initialize index:`, error);
    throw error;
  }
}
