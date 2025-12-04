import { Client } from "@elastic/elasticsearch";
import { detectEmbeddingDimensions } from "../../../lib/embedding-dimensions";
import { ProductEmbeddingJobData } from "../types";

export class IndexManager {
  private client: Client;
  public readonly indexName: string;

  constructor(client: Client, indexName: string) {
    this.client = client;
    this.indexName = indexName;
  }

  private async getIndexDimensions(): Promise<number | null> {
    try {
      const mapping = await this.client.indices.getMapping({
        index: this.indexName,
      });

      const indexMapping = mapping[this.indexName];
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

  async initializeIndex(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({
        index: this.indexName,
      });

      const currentDims = await detectEmbeddingDimensions();
      console.log(
        `[ELASTICSEARCH MODULE] 🔍 Detected embedding dimensions: ${currentDims}`
      );

      if (!exists) {
        await this.client.indices.create({
          index: this.indexName,
          mappings: {
            properties: {
              product_id: { type: "keyword" },
              embedded_text: { type: "text" },
              embedding_vector: {
                type: "dense_vector",
                dims: currentDims,
              },
              metadata: {
                type: "object",
                properties: {
                  title: { type: "text" },
                  brand: { type: "text" },
                  categories: { type: "text" },
                  tags: { type: "text" },
                },
                dynamic: true,
              },
              generated_at: { type: "date" },
            },
          },
        });

        console.log(
          `[ELASTICSEARCH MODULE] ✅ Index "${this.indexName}" created with ${currentDims} dimensions`
        );
      } else {
        const indexDims = await this.getIndexDimensions();

        if (indexDims === null) {
          console.warn(
            `[ELASTICSEARCH MODULE] ⚠️ Unable to determine index embedding dimensions for "${this.indexName}". ` +
              `Consider running 'npm run reindex' to recreate the index.`
          );
        } else if (indexDims !== currentDims) {
          console.error(
            `\n[ELASTICSEARCH MODULE] ❌ Dimension mismatch:\n` +
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
            `[ELASTICSEARCH MODULE] ✅ Index exists with ${indexDims}D dimensions`
          );
        }
      }
    } catch (error) {
      console.error(
        `[ELASTICSEARCH MODULE] ❌ Failed to initialize index:`,
        error
      );
      throw error;
    }
  }

  async indexEmbedding(
    data: ProductEmbeddingJobData & {
      embedding: { vectors: number[]; dimensions: number };
    }
  ): Promise<void> {
    const { product_id, text_to_embed, embedding, metadata } = data;

    await this.client.index({
      index: this.indexName,
      id: product_id,
      document: {
        product_id,
        embedded_text: text_to_embed, // Store as 'embedded_text' since it's now been embedded
        embedding: {
          vectors: embedding.vectors,
          dimensions: embedding.dimensions,
        },
        embedding_vector: embedding.vectors,
        metadata: metadata || {},
        generated_at: new Date().toISOString(),
      },
    });

    console.log(
      `[ELASTICSEARCH MODULE] ✅ Indexed embedding for product ${product_id}`
    );
  }

  async deleteIndex(): Promise<void> {
    const exists = await this.client.indices.exists({
      index: this.indexName,
    });

    if (exists) {
      await this.client.indices.delete({
        index: this.indexName,
      });
      console.log(
        `[ELASTICSEARCH MODULE] 🗑️ Index "${this.indexName}" deleted`
      );
    }
  }
}
