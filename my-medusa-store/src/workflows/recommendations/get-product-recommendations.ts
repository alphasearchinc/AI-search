import { createWorkflow, WorkflowResponse } from "@medusajs/workflows-sdk";
import { getProductEmbeddingStep } from "./steps/get-product-embedding";
import { getSimilarProductsStep } from "./steps/get-similar-products";
import { RecommendationsResult } from "../../modules/elasticsearch/types";

type GetProductRecommendationsInput = {
  product_id: string;
  limit: number;
};

export const getProductRecommendationsWorkflow = createWorkflow(
  "get-product-recommendations",
  (input: GetProductRecommendationsInput): RecommendationsResult => {
    const { embedding } = getProductEmbeddingStep(input.product_id);

    const result = getSimilarProductsStep({
      productId: input.product_id,
      embedding,
      limit: input.limit,
    });

    return new WorkflowResponse(result);
  }
);