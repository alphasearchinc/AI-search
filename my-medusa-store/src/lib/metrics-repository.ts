import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

export interface SearchMetrics {
  query: string;
  query_length: number;
  embedding_dimensions: number;
  embedding_generation_ms: number;
  elasticsearch_query_ms: number;
  total_duration_ms: number;
  results_count: number;
  filters_applied?: string[];
  user_type: 'admin' | 'store';
}

export class MetricsRepository {
  /**
   * Record a search operation to the metrics database.
   * Non-blocking, failures are logged but don't throw.
   */
  async recordSearch(metrics: SearchMetrics): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO search_metrics (
          query, query_length, embedding_dimensions,
          embedding_generation_ms, elasticsearch_query_ms, total_duration_ms,
          results_count, filters_applied, user_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          metrics.query,
          metrics.query_length,
          metrics.embedding_dimensions,
          metrics.embedding_generation_ms,
          metrics.elasticsearch_query_ms,
          metrics.total_duration_ms,
          metrics.results_count,
          metrics.filters_applied || null,
          metrics.user_type,
        ]
      );
    } catch (error) {
      // Don't throw, metrics failures shouldn't break user requests
      console.error('[METRICS] Failed to record search:', error);
    }
  }

  async close(): Promise<void> {
    await pool.end();
  }
}

export const metricsRepository = new MetricsRepository();