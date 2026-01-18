import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * GET /admin/deployment-info
 *
 * Simple hello world endpoint for CI/CD deployment demonstration.
 * Will be beautiful
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.json({
    message: "Hello World!",
    timestamp: new Date().toISOString(),
  });
};
