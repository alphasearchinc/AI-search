import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { metricsRepository } from "../../../lib/metrics-repository";

type MetricsQuery = {
  timeRange?: string;
};

export const GET = async (
  req: AuthenticatedMedusaRequest<MetricsQuery>,
  res: MedusaResponse
) => {
  const logger = req.scope.resolve("logger") as any;
  
  // Safely extract timeRange from query params
  const rawTimeRange = req.query.timeRange;
  const timeRange = typeof rawTimeRange === 'string' ? rawTimeRange : '24h';

  // Validate time range format (e.g., "24h", "7d", "30d")
  if (!/^\d+(h|d|w)$/.test(timeRange)) {
    return res.status(400).json({
      message: "Invalid timeRange format. Use format like '24h', '7d', or '30d'",
    });
  }

  try {
    const [searchStats, topQueries, slowQueries, embeddingStats, embeddingFailures] = await Promise.all([
      metricsRepository.getSearchStats(timeRange),
      metricsRepository.getTopQueries(10, timeRange),
      metricsRepository.getSlowQueries(2000, 10),
      metricsRepository.getEmbeddingStats(timeRange),
      metricsRepository.getEmbeddingFailures(10, timeRange),
    ]);

    res.json({
      time_range: timeRange,
      search: {
        stats: searchStats,
        top_queries: topQueries,
        slow_queries: slowQueries,
      },
      embedding: {
        stats: embeddingStats,
        failures: embeddingFailures,
      },
    });
  } catch (error: any) {
    logger.error('[Metrics] Failed to fetch dashboard data', error);
    res.status(500).json({
      message: 'Failed to retrieve metrics',
      detail: error.message,
    });
  }
};