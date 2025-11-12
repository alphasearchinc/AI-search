import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { PRODUCT_EMBEDDING_MODULE } from "../../../modules/product-embedding";
import ProductEmbeddingService from "../../../modules/product-embedding/service";

// GET all embeddings
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const embeddingService: ProductEmbeddingService = req.scope.resolve(
    PRODUCT_EMBEDDING_MODULE
  );

  const embeddings = await embeddingService.getAllEmbeddings();

  res.json({
    embeddings,
    count: embeddings.length,
  });
};
