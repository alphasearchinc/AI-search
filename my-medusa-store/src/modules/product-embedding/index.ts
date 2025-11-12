import { Module } from "@medusajs/framework/utils";
import ProductEmbeddingService from "./service";
import { ProductEmbedding } from "./models/product-embedding";

export const PRODUCT_EMBEDDING_MODULE = "productEmbedding";

export default Module(PRODUCT_EMBEDDING_MODULE, {
  service: ProductEmbeddingService,
});
