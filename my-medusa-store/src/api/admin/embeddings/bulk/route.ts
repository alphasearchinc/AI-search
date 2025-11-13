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

  const limit = 100;
  let offset = 0;
  let total = 0;

  const results = {
    total,
    enqueued: 0,
    failed: 0,
    errors: [] as Array<{ product_id: string; error: string }>,
  };

  logger.info(`Starting bulk embedding job enqueue...`);

  while (true) {
    const [products, count] = await productModuleService.listAndCountProducts(
      {},
      {
        skip: offset,
        take: limit,
      }
    );

    if (total === 0) {
      total = count;
      results.total = count;
      logger.info(`Found ${count} products to embed`);
    }

    if (!products.length) {
      break;
    }

    for (const product of products) {
      try {
        const { result } = await embedProductWorkflow(req.scope).run({
          input: {
            product_id: product.id,
          },
        });
        results.enqueued++;
        logger.info(
          `Queued embedding job ${result.job_id} for product: ${product.id}`
        );
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          product_id: product.id,
          error: error.message || "Unknown error",
        });
        logger.error(`Failed to queue embedding for product ${product.id}:`, error);
      }
    }

    offset += products.length;

    if (offset >= count) {
      break;
    }
  }

  logger.info(
    `Bulk embedding enqueue complete: ${results.enqueued} queued, ${results.failed} failed`
  );

  res.json({
    message: "Bulk embedding jobs enqueued",
    results,
  });
};
