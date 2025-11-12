import { MedusaService } from "@medusajs/framework/utils";
import { ProductEmbedding } from "./models/product-embedding";

class ProductEmbeddingService extends MedusaService({
  ProductEmbedding,
}) {
  // Create a new embedding
  async createEmbedding(data: {
    product_id: string;
    embedding_vector: number[];
    embedded_text: string;
    metadata?: Record<string, any>;
  }) {
    return await this.createProductEmbeddings({
      product_id: data.product_id,
      embedding_vector: data.embedding_vector as any,
      embedded_text: data.embedded_text,
      metadata: data.metadata as any,
      generated_at: new Date(),
    });
  }

  // Get embedding by product ID
  async getEmbeddingByProductId(productId: string) {
    const embeddings = await this.listProductEmbeddings({
      product_id: productId,
    });

    return embeddings.length > 0 ? embeddings[0] : null;
  }

  // Get all embeddings
  async getAllEmbeddings() {
    return await this.listProductEmbeddings();
  }

  // Update existing embedding
  async updateEmbedding(
    id: string,
    data: {
      embedding_vector?: number[];
      embedded_text?: string;
      metadata?: Record<string, any>;
    }
  ) {
    const updateData: any = {
      generated_at: new Date(),
    };

    if (data.embedding_vector)
      updateData.embedding_vector = data.embedding_vector;
    if (data.embedded_text) updateData.embedded_text = data.embedded_text;
    if (data.metadata) updateData.metadata = data.metadata;

    return await this.updateProductEmbeddings({
      id,
      ...updateData,
    });
  }

  // Delete embedding by product ID
  async deleteEmbeddingByProductId(productId: string) {
    const embedding = await this.getEmbeddingByProductId(productId);
    if (embedding) {
      await this.deleteProductEmbeddings((embedding as any).id);
    }
  }
}

export default ProductEmbeddingService;
