import { Client } from "@elastic/elasticsearch";

/**
 * Service for retrieving embeddings from Elasticsearch.
 * Handles read operations for embedding data.
 */
export class EmbeddingRetrievalService {
  constructor(private client: Client, private indexName: string) {}

  /**
   * List embeddings with pagination.
   */
  async listEmbeddings(options: { limit?: number; offset?: number }): Promise<{
    embeddings: Array<{
      id: string;
      product_id: string;
      embedded_text: string;
      metadata?: any;
      generated_at?: string;
      embedding?: any;
    }>;
    count: number;
  }> {
    const searchResponse = await this.client.search({
      index: this.indexName,
      from: options.offset || 0,
      size: options.limit || 50,
      sort: [{ generated_at: { order: "desc" } }],
      _source: [
        "product_id",
        "embedded_text",
        "metadata",
        "generated_at",
        "embedding",
      ],
    });

    const embeddings = searchResponse.hits.hits.map((hit) => ({
      id: hit._id as string,
      ...(hit._source as any),
    }));

    const count =
      typeof searchResponse.hits.total === "number"
        ? searchResponse.hits.total
        : searchResponse.hits.total?.value || embeddings.length;

    return { embeddings, count };
  }

  /**
   * Get a single embedding by product ID.
   * Note: dense_vector fields are not stored in _source by default,
   * so we retrieve them using the fields parameter.
   */
  async getEmbeddingByProductId(productId: string): Promise<{
    id: string;
    product_id: string;
    embedded_text: string;
    embedding?: { vectors: number[]; dimensions: number };
    metadata?: Record<string, any>;
    generated_at?: string;
  } | null> {
    try {
      const result = await this.client.search({
        index: this.indexName,
        query: {
          term: { product_id: productId },
        },
        _source: ["product_id", "embedded_text", "metadata", "generated_at", "embedding.dimensions"],
        fields: ["embedding.vectors"],
        size: 1,
      });

      if (result.hits.hits.length === 0) {
        return null;
      }

      const hit = result.hits.hits[0];
      const source = (hit._source || {}) as Record<string, any>;
      const vectors = (hit.fields as any)?.[("embedding.vectors")]?.[0];

      return {
        id: hit._id as string,
        product_id: source.product_id,
        embedded_text: source.embedded_text,
        embedding: vectors ? {
          vectors,
          dimensions: source.embedding?.dimensions || vectors.length,
        } : source.embedding,
        metadata: source.metadata,
        generated_at: source.generated_at,
      };
    } catch (error: any) {
      if (error?.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }
}
