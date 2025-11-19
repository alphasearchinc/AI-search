import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ELASTICSEARCH_MODULE } from "../../../modules/elasticsearch";

import ElasticsearchModuleService from "../../../modules/elasticsearch/services/main";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const limit = parseInt((req.query?.limit as string) || "50", 10);
  const offset = parseInt((req.query?.offset as string) || "0", 10);

  try {

    const result = await elasticsearchService.listEmbeddings({ offset, limit });
    const elasticsearchService: ElasticsearchModuleService = req.scope.resolve(
      ELASTICSEARCH_MODULE
    );
    const searchResponse = await elasticsearchService.getClient().search({
      index: elasticsearchService.PRODUCT_EMBEDDINGS_INDEX,
      from: offset,
      size: limit,
      sort: [
        {
          generated_at: {
            order: "desc",
          },
        },
      ],
      _source: [
        "product_id",
        "embedded_text",
        "metadata",
        "generated_at",
      ],
    });

    const embeddings = searchResponse.hits.hits.map((hit) => {
      const { embedding, ...safeSource } = (hit._source ||
        {}) as Record<string, any>;
      return {
        id: hit._id,
        ...safeSource,
      };
    });

    res.json(result);
  } catch (error: any) {
    const logger = req.scope.resolve("logger");
    logger.error("[List Embeddings] Failed to fetch embeddings:", error);

    return res.status(500).json({
      message: "Failed to fetch embeddings from Elasticsearch",
      error: error.message,
    });
  }
};
