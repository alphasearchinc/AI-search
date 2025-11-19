import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ELASTICSEARCH_MODULE } from "../../../../modules/elasticsearch";
import type ElasticsearchModuleService from "../../../../modules/elasticsearch/service";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { product_id } = req.params;

  try {
    const elasticsearchService: ElasticsearchModuleService =
      req.scope.resolve(ELASTICSEARCH_MODULE);

    const embedding = await elasticsearchService.getEmbeddingByProductId(
      product_id
    );

    if (!embedding) {
      return res.status(404).json({
        message: `No embedding found for product: ${product_id}`,
      });
    }

    res.json({ embedding });
  } catch (error: any) {
    const logger = req.scope.resolve("logger");
    logger.error(`[Get Embedding] Failed for product ${product_id}:`, error);

    return res.status(500).json({
      message: "Failed to retrieve embedding",
      error: error.message,
    });
  }
};
