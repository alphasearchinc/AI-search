import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";

type GetAllProductsInput = {
  batch_size?: number;
};

type ProductBatch = {
  products: Array<{ id: string; title?: string }>;
  total_count: number;
  current_offset: number;
  has_more: boolean;
};

export const getAllProductsStep = createStep(
  "get-all-products",
  async (input: GetAllProductsInput, { container }) => {
    const logger = container.resolve("logger");
    const productModuleService = container.resolve(Modules.PRODUCT);
    const batchSize = input.batch_size || 100;

    logger.info(`[Bulk Embedding] Fetching products with batch size ${batchSize}`);

    // Get total count first
    const [, totalCount] = await productModuleService.listAndCountProducts(
      {},
      { take: 0 }
    );

    // Fetch first batch
    const [products] = await productModuleService.listAndCountProducts(
      {},
      {
        skip: 0,
        take: batchSize,
      }
    );

    const result: ProductBatch = {
      products: products.map((p: any) => ({ id: p.id, title: p.title })),
      total_count: totalCount,
      current_offset: products.length,
      has_more: products.length < totalCount,
    };

    logger.info(
      `[Bulk Embedding] Found ${totalCount} total products, loaded first ${products.length}`
    );

    return new StepResponse(result);
  }
);
