import { createWorkflow, WorkflowResponse } from "@medusajs/workflows-sdk";
import { getProductEmbeddingStep } from "./steps/get-product-embedding";
import { getSimilarProductsStep } from "./steps/get-similar-products";

type GetProductRecommendationsInput = {
  product_id: string;
  limit: number;
};

type GetProductRecommendationsOutput = {
  product_id: string;
  hits: any[];
  count: number;
  searchDuration: number;
};

export const getProductRecommendationsWorkflow = createWorkflow(
  "get-product-recommendations",
  (input: GetProductRecommendationsInput) => {
    const { embedding } = getProductEmbeddingStep(input.product_id);

    const result = getSimilarProductsStep({
      productId: input.product_id,
      embedding,
      limit: input.limit,
    });

    return new WorkflowResponse(result);
  }
);