import type { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ELASTICSEARCH_MODULE } from "../../../../modules/elasticsearch";
import type ElasticsearchModuleService from "../../../../modules/elasticsearch/services/main";

/**
 * POST /admin/embeddings/explain
 * 
 * Explains scoring for a specific product against a query.
 * Shows how BM25 field boosting contributes to the final score.
 */
export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> => {
  const { query, product_id } = req.body as {
    query: string;
    product_id: string;
  };

  if (!query || !product_id) {
    res.status(400).json({
      error: "Both 'query' and 'product_id' are required",
    });
    return;
  }

  try {
    const elasticsearchService = req.scope.resolve<ElasticsearchModuleService>(
      ELASTICSEARCH_MODULE
    );

    const client = elasticsearchService.getClient();
    const indexName = elasticsearchService.PRODUCT_EMBEDDINGS_INDEX;

    // Build BM25 query with field boosting
    const bm25Query = {
      bool: {
        should: [
          {
            match: {
              "metadata.title": {
                query,
                boost: 3.0,
              },
            },
          },
          {
            match: {
              "metadata.brand": {
                query,
                boost: 2.5,
              },
            },
          },
          {
            match: {
              "metadata.categories": {
                query,
                boost: 2.0,
              },
            },
          },
          {
            match: {
              "metadata.tags": {
                query,
                boost: 1.5,
              },
            },
          },
          {
            match: {
              embedded_text: query,
            },
          },
        ],
        minimum_should_match: 1,
      },
    };

    // Use Elasticsearch explain API
    const explanation = await client.explain({
      index: indexName,
      id: product_id,
      query: bm25Query,
    });

    res.json({
      product_id,
      query,
      matched: explanation.matched,
      explanation: explanation.explanation,
      score: explanation.explanation?.value || 0,
    });
  } catch (error) {
    console.error("Error explaining search:", error);
    res.status(500).json({
      error: "Failed to explain search",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
