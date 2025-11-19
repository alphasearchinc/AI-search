import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";

type EnrichWithProductsInput = {
  hits: any[];
  published_only?: boolean;
};

type ProductSummary = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  handle?: string | null;
  thumbnail?: string | null;
};

type EnrichedHit = {
  id: string;
  score: number;
  bm25_score?: number;
  vector_score?: number;
  product: ProductSummary;
  metadata?: Record<string, any>;
};

/**
 * Step to enrich search hits with product data.
 * Optionally filters to published products only (for store API).
 */
export const enrichWithProductsStep = createStep(
  "enrich-with-products",
  async (input: EnrichWithProductsInput, { container }) => {
    const logger = container.resolve("logger");
    const productModuleService = container.resolve(Modules.PRODUCT);
    const { hits, published_only = false } = input;

    if (!hits.length) {
      return new StepResponse([]);
    }

    // Extract unique product IDs
    const productIds = Array.from(
      new Set(
        hits
          .map((hit) => hit.product_id)
          .filter(
            (id): id is string => typeof id === "string" && id.trim().length > 0
          )
      )
    );

    if (!productIds.length) {
      return new StepResponse([]);
    }

    // Fetch products (with optional published filter)
    const filters: any = { id: productIds };
    if (published_only) {
      filters.status = ["published"];
    }

    const [products] = await productModuleService.listAndCountProducts(
      filters,
      {
        take: productIds.length,
      }
    );

    const productMap = new Map(
      products.map((product: any) => [product.id, product])
    );

    // Build enriched hits
    const enrichedHits: EnrichedHit[] = [];
    for (const hit of hits) {
      if (!hit.product_id) continue;

      const product = productMap.get(hit.product_id);
      if (!product) {
        // Skip unpublished products if filtering
        if (published_only) continue;

        // For admin, include hit without product data
        logger.warn(`[Search] Product ${hit.product_id} not found`);
        continue;
      }

      enrichedHits.push({
        id: hit.id,
        score: hit.score,
        bm25_score: hit.bm25_score,
        vector_score: hit.vector_score,
        product: selectProductFields(product),
        metadata: hit.metadata,
      });
    }

    logger.debug(
      `[Search] Enriched ${enrichedHits.length} hits with product data`
    );

    return new StepResponse(enrichedHits);
  }
);

/**
 * Select minimal product fields for API response.
 */
function selectProductFields(product: Record<string, any>): ProductSummary {
  return {
    id: product.id,
    title: product.title ?? null,
    subtitle: product.subtitle ?? null,
    description: product.description ?? null,
    handle: product.handle ?? null,
    thumbnail: product.thumbnail ?? null,
  };
}
