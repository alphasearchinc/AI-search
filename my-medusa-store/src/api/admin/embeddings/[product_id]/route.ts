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
    const result = await elasticsearchClient.search({
      index: PRODUCT_EMBEDDINGS_INDEX,
      query: {
        term: { product_id },
      },
      _source: true,
      fields: ["embedding_vector"],
      size: 1,
    });

    if (result.hits.hits.length === 0) {
      return res.status(404).json({
        message: `No embedding found for product: ${product_id}`,
      });
    }

    const hit = result.hits.hits[0];
    res.json({
      embedding: {
        id: hit._id,
        ...(hit._source as Record<string, any>),
        embedding_vector: hit.fields?.embedding_vector?.[0] || null,
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
