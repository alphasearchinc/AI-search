import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * GET /admin/deployment-info
 *
 * Simple hello world endpoint for CI/CD deployment demonstration.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.json({
    message: "Hello World!",
    timestamp: new Date().toISOString(),
  });
};
