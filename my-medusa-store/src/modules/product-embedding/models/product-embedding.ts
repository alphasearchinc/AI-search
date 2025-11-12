import { model } from "@medusajs/framework/utils";

export const ProductEmbedding = model.define("product_embedding", {
  id: model.id().primaryKey(),
  product_id: model.text().searchable(),
  // Embedding vector stored as JSON array
  embedding_vector: model.json(),
  // Store original text that was embedded (product title + description)
  embedded_text: model.text(),
  // Metadata for additional context (price, category, etc.)
  metadata: model.json().nullable(),
  // When the embedding was generated
  generated_at: model.dateTime(),
});
