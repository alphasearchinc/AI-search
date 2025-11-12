import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { embedProductWorkflow } from "../../../../workflows/product-embedding/embed-product";

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT);
  const logger = req.scope.resolve("logger");

  // Get all products
  const [products] = await productModuleService.listAndCountProducts();

  logger.info(`Starting to embed ${products.length} products...`);

  const results = {
    total: products.length,
    successful: 0,
    failed: 0,
    errors: [] as Array<{ product_id: string; error: string }>,
  };

  // Embed each product
  for (const product of products) {
    try {
      await embedProductWorkflow(req.scope).run({
        input: {
          product_id: product.id,
        },
      });
      results.successful++;
      logger.info(`Successfully embedded product: ${product.id}`);
    } catch (error: any) {
      results.failed++;
      results.errors.push({
        product_id: product.id,
        error: error.message || "Unknown error",
      });
      logger.error(`Failed to embed product ${product.id}:`, error);
    }
  }

  logger.info(
    `Embedding complete: ${results.successful} successful, ${results.failed} failed`
  );

  res.json({
    message: "Bulk embedding completed",
    results,
  });
};
