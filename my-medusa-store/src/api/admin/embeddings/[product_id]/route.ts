import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import {
  elasticsearchClient,
  PRODUCT_EMBEDDINGS_INDEX,
} from "../../../../modules/elasticsearch-client";

// GET embedding by product ID
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { product_id } = req.params;

  try {
    const embedding = await elasticsearchClient.get({
      index: PRODUCT_EMBEDDINGS_INDEX,
      id: product_id,
    });

    res.json({
      embedding: {
        id: embedding._id,
        ...(embedding._source as Record<string, any>),
      },
    });
  } catch (error: any) {
    const statusCode = error?.meta?.statusCode;
    if (statusCode === 404) {
      return res.status(404).json({
        message: `No embedding found for product: ${product_id}`,
      });
    }
    throw error;
  }
};
