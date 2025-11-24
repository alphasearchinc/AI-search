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

export interface SearchStats {
  total_searches: number;
  avg_embedding_ms: number;
  avg_search_ms: number;
  avg_total_ms: number;
  p95_duration_ms: number;
  avg_results: number;
  slow_queries_count: number;
  user_type: string;
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

  /**
   * Get aggregated search statistics for a time range.
   */
  async getSearchStats(timeRange: string = '24h'): Promise<SearchStats[]> {
    const interval = this.parseTimeRange(timeRange);
    const result = await pool.query<SearchStats>(
      `SELECT
        COUNT(*)::int as total_searches,
        ROUND(AVG(embedding_generation_ms))::int as avg_embedding_ms,
        ROUND(AVG(elasticsearch_query_ms))::int as avg_search_ms,
        ROUND(AVG(total_duration_ms))::int as avg_total_ms,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_duration_ms))::int as p95_duration_ms,
        ROUND(AVG(results_count))::int as avg_results,
        COUNT(*) FILTER (WHERE total_duration_ms > 2000)::int as slow_queries_count,
        user_type
      FROM search_metrics
      WHERE timestamp > NOW() - $1::interval
      GROUP BY user_type`,
      [interval]
    );
    return result.rows;
  }

  /**
   * Get the most frequently searched queries.
   */
  async getTopQueries(limit: number = 10, timeRange: string = '24h') {
    const interval = this.parseTimeRange(timeRange);
    const result = await pool.query(
      `SELECT
        query,
        COUNT(*)::int as search_count,
        ROUND(AVG(results_count))::int as avg_results,
        ROUND(AVG(total_duration_ms))::int as avg_duration_ms
      FROM search_metrics
      WHERE timestamp > NOW() - $1::interval
      GROUP BY query
      ORDER BY search_count DESC
      LIMIT $2`,
      [interval, limit]
    );
    return result.rows;
  }

  /**
   * Get queries that exceeded a duration threshold (slow queries).
   */
  async getSlowQueries(thresholdMs: number = 2000, limit: number = 10) {
    const result = await pool.query(
      `SELECT
        query,
        total_duration_ms,
        embedding_generation_ms,
        elasticsearch_query_ms,
        results_count,
        user_type,
        timestamp
      FROM search_metrics
      WHERE total_duration_ms > $1
        AND timestamp > NOW() - INTERVAL '24 hours'
      ORDER BY total_duration_ms DESC
      LIMIT $2`,
      [thresholdMs, limit]
    );
    return result.rows;
  }

  /**
   * Parse time range string (e.g., "24h", "7d") into PostgreSQL interval.
   */
  private parseTimeRange(range: string): string {
    const match = /^(\d+)(h|d|w)$/.exec(range);
    if (!match) return '24 hours';
    const [, num, unit] = match;
    const units: Record<string, string> = { h: 'hours', d: 'days', w: 'weeks' };
    return `${num} ${units[unit]}`;
  }

  async close(): Promise<void> {
    await pool.end();
  }
}

export const metricsRepository = new MetricsRepository();