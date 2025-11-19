import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { metricsRepository } from "../../../lib/metrics-repository";

type RecordSearchMetricsInput = {
  query: string;
  embedding_dimensions: number;
  embedding_generation_ms: number;
  elasticsearch_query_ms: number;
  total_duration_ms: number;
  results_count: number;
  user_type: "store" | "admin";
};

/**
 * Step to asynchronously record search metrics.
 * This step never fails - metrics recording errors are logged but don't affect search.
 */
export const recordSearchMetricsStep = createStep(
  "record-search-metrics",
  async (input: RecordSearchMetricsInput, { container }) => {
    const logger = container.resolve("logger");

    try {
      await metricsRepository.recordSearch({
        query: input.query,
        query_length: input.query.length,
        embedding_dimensions: input.embedding_dimensions,
        embedding_generation_ms: input.embedding_generation_ms,
        elasticsearch_query_ms: input.elasticsearch_query_ms,
        total_duration_ms: input.total_duration_ms,
        results_count: input.results_count,
        filters_applied: undefined,
        user_type: input.user_type,
      });

      logger.debug(`[Search] Recorded metrics for query: "${input.query.slice(0, 50)}..."`);
    } catch (error: any) {
      // Don't fail the workflow if metrics fail
      logger.error(`[Search] Failed to record metrics: ${error.message}`);
    }

    return new StepResponse({ success: true });
  }
);
