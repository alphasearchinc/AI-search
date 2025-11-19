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
    const elasticsearchService: ElasticsearchModuleService =
      req.scope.resolve(ELASTICSEARCH_MODULE);

    const result = await elasticsearchService.listEmbeddings({ offset, limit });

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
