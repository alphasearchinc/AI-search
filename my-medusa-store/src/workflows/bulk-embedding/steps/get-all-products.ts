import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";

type GetAllProductsInput = {
  batch_size?: number;
};

type ProductBatch = {
  products: Array<{ id: string; title?: string }>;
  total_count: number;
};

export const getAllProductsStep = createStep(
  "get-all-products",
  async (input: GetAllProductsInput, { container }) => {
    const logger = container.resolve("logger");
    const productModuleService = container.resolve(Modules.PRODUCT);

    // Get total count
    const [, totalCount] = await productModuleService.listAndCountProducts(
      {},
      { take: 0 }
    );

    logger.info(`[Bulk Embedding] Found ${totalCount} total products`);

    const result: ProductBatch = {
      products: [],
      total_count: totalCount,
    };

    return new StepResponse(result);
  }
);
