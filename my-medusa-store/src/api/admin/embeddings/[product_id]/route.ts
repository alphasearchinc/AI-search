import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { PRODUCT_EMBEDDING_MODULE } from "../../../../modules/product-embedding";
import ProductEmbeddingService from "../../../../modules/product-embedding/service";

// GET embedding by product ID
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { product_id } = req.params;

  const embeddingService: ProductEmbeddingService = req.scope.resolve(
    PRODUCT_EMBEDDING_MODULE
  );

  const embedding = await embeddingService.getEmbeddingByProductId(product_id);

  if (!embedding) {
    return res.status(404).json({
      message: `No embedding found for product: ${product_id}`,
    });
  }

  res.json({
    embedding,
  });
};
