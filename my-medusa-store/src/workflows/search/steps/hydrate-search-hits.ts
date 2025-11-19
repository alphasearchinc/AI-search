import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";

export type StoreSemanticSearchProductSummary = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  handle?: string | null;
  thumbnail?: string | null;
};

export type StoreSemanticSearchHit = {
  id: string;
  score: number;
  bm25_score?: number;
  vector_score?: number;
  product: StoreSemanticSearchProductSummary;
  metadata?: Record<string, any>;
};

const selectProductFields = (
  product: Record<string, any>
): StoreSemanticSearchProductSummary => ({
  id: product.id,
  title: product.title ?? null,
  subtitle: product.subtitle ?? null,
  description: product.description ?? null,
  handle: product.handle ?? null,
  thumbnail: product.thumbnail ?? null,
});

type HydrateSearchHitsInput = {
  hits: any[];
  limit: number;
};

export const hydrateSearchHitsStep = createStep(
  "hydrate-search-hits-step",
  async ({ hits, limit }: HydrateSearchHitsInput, { container }) => {
    const productModuleService = container.resolve(Modules.PRODUCT);
    
    const productIds = Array.from(
      new Set(
        hits
          .map((hit) => hit.product_id)
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      )
    );

    if (productIds.length === 0) {
      return new StepResponse([]);
    }

    const [products] = await productModuleService.listAndCountProducts(
      {
        id: productIds,
        status: ["published"],
      },
      {
        take: productIds.length,
      }
    );

    const productMap = new Map(products.map((product: any) => [product.id, product]));
    const hydratedHits: StoreSemanticSearchHit[] = [];
    
    for (const hit of hits) {
      if (!hit.product_id) continue;

      const product = productMap.get(hit.product_id);
      if (!product) continue;

      hydratedHits.push({
        id: hit.id,
        score: hit.score,
        bm25_score: hit.bm25_score,
        vector_score: hit.vector_score,
        product: selectProductFields(product),
        metadata: hit.metadata,
      });
    }

    return new StepResponse(hydratedHits.slice(0, limit));
  }
);
