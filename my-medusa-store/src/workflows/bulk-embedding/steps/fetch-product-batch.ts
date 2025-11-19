import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";

type FetchProductBatchInput = {
  offset: number;
  batch_size: number;
};

type ProductBatchResult = {
  product_ids: string[];
  next_offset: number;
  has_more: boolean;
};

export const fetchProductBatchStep = createStep(
  "fetch-product-batch",
  async (input: FetchProductBatchInput, { container }) => {
    const logger = container.resolve("logger");
    const productModuleService = container.resolve(Modules.PRODUCT);

    const [products, totalCount] = await productModuleService.listAndCountProducts(
      {},
      {
        skip: input.offset,
        take: input.batch_size,
      }
    );

    const productIds = products.map((p: any) => p.id);
    const nextOffset = input.offset + products.length;
    const hasMore = nextOffset < totalCount;

    logger.debug(
      `[Bulk Embedding] Fetched batch at offset ${input.offset}: ${productIds.length} products (${nextOffset}/${totalCount})`
    );

    return new StepResponse({
      product_ids: productIds,
      next_offset: nextOffset,
      has_more: hasMore,
    } as ProductBatchResult);
  }
);
