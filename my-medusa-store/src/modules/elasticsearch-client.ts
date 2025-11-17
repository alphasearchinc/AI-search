import { Client } from "@elastic/elasticsearch";
import { detectEmbeddingDimensions } from "../lib/embedding-dimensions";

const ELASTICSEARCH_URL =
  process.env.ELASTICSEARCH_URL || "http://localhost:9200";

export const PRODUCT_EMBEDDINGS_INDEX = "product-embeddings";

export const elasticsearchClient = new Client({
  node: ELASTICSEARCH_URL,
});

async function getIndexDimensions(): Promise<number | null> {
  try {
    const mapping = await elasticsearchClient.indices.getMapping({
      index: PRODUCT_EMBEDDINGS_INDEX,
    });

    const indexMapping = mapping[PRODUCT_EMBEDDINGS_INDEX];
    const embeddingVectorField =
      indexMapping?.mappings?.properties?.embedding_vector;

    if (
      embeddingVectorField?.type === "dense_vector" &&
      typeof embeddingVectorField.dims === "number"
    ) {
      return embeddingVectorField.dims;
    }

    return null;
  } catch (error) {
    return null;
  }
}

export async function initializeProductEmbeddingIndex(): Promise<void> {
  try {
    const exists = await elasticsearchClient.indices.exists({
      index: PRODUCT_EMBEDDINGS_INDEX,
    });

    const currentDims = await detectEmbeddingDimensions();
    console.log(
      `[ELASTICSEARCH] 🔍 Detected embedding dimensions: ${currentDims}`
    );

    if (!exists) {
      await elasticsearchClient.indices.create({
        index: PRODUCT_EMBEDDINGS_INDEX,
        mappings: {
          properties: {
            product_id: { type: "keyword" },
            embedded_text: { type: "text" },
            // Dense vector used for similarity search
            embedding_vector: {
              type: "dense_vector",
              dims: currentDims,
            },
            // Keep metadata and generated_at for filtering/sorting
            metadata: { type: "object", dynamic: true },
            generated_at: { type: "date" },
          },
        },
      });

      console.log(
        `[ELASTICSEARCH] ✅ Index "${PRODUCT_EMBEDDINGS_INDEX}" created with ${currentDims} dimensions`
      );
    } else {
      const indexDims = await getIndexDimensions();

      if (indexDims === null) {
        console.warn(
          `[ELASTICSEARCH] ⚠️ Unable to determine index embedding dimensions for "${PRODUCT_EMBEDDINGS_INDEX}". ` +
          `Consider running 'npm run reindex' to recreate the index.`
        );
      } else if (indexDims !== currentDims) {
         console.error(
           `\n[ELASTICSEARCH] ❌ Dimension mismatch:\n` +
             `  - Index: ${indexDims}D\n` +
             `  - Current model: ${currentDims}D\n\n` +
             `Fix: npm run reindex\n`
         );
 
         throw new Error(
           `Embedding dimension mismatch (index=${indexDims}D, model=${currentDims}D). Run 'npm run reindex'.`
         );
       }

      if (indexDims !== null) {
        console.log(
          `[ELASTICSEARCH] ✅ Index exists with ${indexDims}D dimensions`
        );
      }
    }
  } catch (error) {
    console.error(`[ELASTICSEARCH] ❌ Failed to initialize index:`, error);
    throw error;
  }
}
