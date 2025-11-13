import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { embedProductWorkflow } from "../../../../../workflows/product-embedding/embed-product";

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { product_id } = req.params;

  // Execute the workflow to embed the product
  const { result } = await embedProductWorkflow(req.scope).run({
    input: {
      product_id,
    },
  });

  res.json({
    message: "Product embedding job enqueued",
    job_id: result.job_id,
    product_id,
  });
};
