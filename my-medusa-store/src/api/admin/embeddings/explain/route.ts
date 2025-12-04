import type { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ELASTICSEARCH_MODULE } from "../../../../modules/elasticsearch";
import type ElasticsearchModuleService from "../../../../modules/elasticsearch/services/main";
import { buildBM25Query } from "../../../../modules/elasticsearch/services/search-engine/query-builder";
import { getFuzzyConfig } from "../../../../modules/elasticsearch/utils/config";

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

    // Get fuzzy configuration from module options (same as search uses)
    const fuzzyConfig = getFuzzyConfig(elasticsearchService["options_"]);

    // Build BM25 query using shared query builder (maintains consistency)
    const bm25Query = buildBM25Query({
      query,
      fuzzyConfig: {
        enabled: fuzzyConfig.enabled,
        fuzzinessLevel: fuzzyConfig.fuzzinessLevel,
        prefixLength: fuzzyConfig.prefixLength,
        maxExpansions: fuzzyConfig.maxExpansions,
      },
      fuzzyEnabled: fuzzyConfig.enabled,
      filterClauses: [],
    });

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
