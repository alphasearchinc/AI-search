import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * GET /admin/deployment-info
 * 
 * Returns deployment and system information useful for verifying deployments.
 * Perfect for CI/CD demonstrations and health checks.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve("logger") as any;

  try {
    // Get git commit info (if available)
    let gitCommit = "unknown";
    let gitBranch = "unknown";
    try {
      const { stdout: commit } = await execAsync("git rev-parse --short HEAD");
      gitCommit = commit.trim();
      const { stdout: branch } = await execAsync("git rev-parse --abbrev-ref HEAD");
      gitBranch = branch.trim();
    } catch (error) {
      // Git info might not be available in production container
      logger.debug("Git info not available", error);
    }

    // Get deployment timestamp from environment or use current time
    const deployedAt = process.env.DEPLOYED_AT || new Date().toISOString();

    // System information
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: process.uptime(),
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
    };

    const deploymentInfo = {
      version: "0.0.1", // From package.json
      environment: process.env.NODE_ENV || "development",
      gitCommit,
      gitBranch,
      deployedAt,
      requestedAt: new Date().toISOString(),
      system: systemInfo,
    };

    logger.info("[Deployment Info] Request received", {
      commit: gitCommit,
      environment: deploymentInfo.environment,
    });

    res.json(deploymentInfo);
  } catch (error: any) {
    logger.error("[Deployment Info] Failed to fetch deployment info", error);
    res.status(500).json({
      message: "Failed to fetch deployment information",
      error: error.message,
    });
  }
};
