import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ELASTICSEARCH_MODULE } from "../../../modules/elasticsearch";
import ElasticsearchModuleService from "../../../modules/elasticsearch/service";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const limit = parseInt((req.query?.limit as string) || "50", 10);
  const offset = parseInt((req.query?.offset as string) || "0", 10);

  try {
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
        "embedding",
      ],
    });

    const embeddings = searchResponse.hits.hits.map((hit) => ({
      id: hit._id,
      ...(hit._source as Record<string, any>),
    }));

    res.json({
      embeddings,
      count: searchResponse.hits.total
        ? typeof searchResponse.hits.total === "number"
          ? searchResponse.hits.total
          : searchResponse.hits.total.value
        : embeddings.length,
    });
  } catch (error: any) {
    const logger = req.scope.resolve("logger") as any;
    logger.error("Failed to fetch embeddings:", error);
    return res.status(500).json({
      message: "Failed to fetch embeddings from Elasticsearch",
      error: error.message,
    });
  }
};
