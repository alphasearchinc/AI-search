# Observability & Performance Metrics

This document explains how performance metrics are collected and stored in the project.

## Overview

The project uses **TimescaleDB** (PostgreSQL with time-series extensions) to collect and analyze performance data from search operations. All metrics are stored automatically during runtime and can be queried via an admin dashboard API.

### What We Track

Currently, the system tracks **search performance metrics**:
- Query text and length
- Embedding generation latency
- Elasticsearch query latency
- Total request duration
- Number of results returned
- Which filters were applied (if any)
- User type (admin vs storefront customer)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Search Request Flow                       │
│                                                             │
│  User Query → embedText() → semanticSearch() → Response     │
│      │            │                │                        │
│      └────────────┴────────────────┘                        │
│                   │                                         │
│                   ▼                                         │
│         metricsRepository.recordSearch()                    │
│                   │                                         │
│                   ▼                                         │
│         ┌──────────────────┐                                │
│         │  PostgreSQL      │                                │
│         │  (TimescaleDB)   │                                │
│         │                  │                                │
│         │  search_metrics  │                                │
│         └──────────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### TimescaleDB Setup

The project uses TimescaleDB (PostgreSQL extension) instead of vanilla PostgreSQL for:
- **10x faster inserts** for time-series data
- **Automatic data retention** (deletes data older than 90 days)
- **Time-bucketing queries** for aggregations (e.g., "avg latency per hour")
- **Automatic compression** (optional, saves 90%+ storage)

Configuration: `docker-compose.yml` uses `timescale/timescaledb:latest-pg16` image.

### Search Metrics Table

**File:** `my-medusa-store/init-timescale.sql`

```sql
CREATE TABLE IF NOT EXISTS search_metrics (
  id BIGSERIAL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  query TEXT NOT NULL,
  query_length INTEGER NOT NULL,
  embedding_dimensions INTEGER NOT NULL,
  embedding_generation_ms INTEGER NOT NULL,
  elasticsearch_query_ms INTEGER NOT NULL,
  total_duration_ms INTEGER NOT NULL,
  results_count INTEGER NOT NULL,
  filters_applied TEXT[],
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('admin', 'store'))
);

SELECT create_hypertable('search_metrics', 'timestamp', if_not_exists => TRUE);
CREATE INDEX idx_search_timestamp ON search_metrics (timestamp DESC);
CREATE INDEX idx_search_user_type ON search_metrics (user_type, timestamp DESC);
```

**Key fields:**
- `timestamp` - When the search occurred (auto-set)
- `query` - The actual search query text
- `query_length` - Character count of the query
- `embedding_dimensions` - Vector dimensions (384 for local, 1536 for OpenAI)
- `embedding_generation_ms` - Time to generate embedding (includes API call)
- `elasticsearch_query_ms` - Time for Elasticsearch to execute semantic search
- `total_duration_ms` - End-to-end request duration
- `results_count` - Number of products returned
- `filters_applied` - Array of filter types used (e.g., `['product_ids']`)
- `user_type` - `'admin'` or `'store'` (admin dashboard vs storefront)

**Retention:** Data older than 90 days is automatically deleted via TimescaleDB retention policy.

### Future Tables (Defined but Not Yet Used)

The schema also defines `embedding_metrics` and `worker_metrics` tables for tracking:
- Product embedding generation performance
- Worker job processing times

These are ready for future instrumentation but not currently populated.

## Metrics Collection

### Implementation

**File:** `src/lib/metrics-repository.ts`

The `MetricsRepository` class handles all database interactions:

```typescript
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
  async recordSearch(metrics: SearchMetrics): Promise<void>
  async getSearchStats(timeRange: string = '24h'): Promise<SearchStats[]>
  async getTopQueries(limit: number = 10, timeRange: string = '24h')
  async getSlowQueries(thresholdMs: number = 2000, limit: number = 10)
}
```

**Key characteristics:**
- **Non-blocking:** Uses `.catch()` wrapper so metric failures don't break user requests
- **Separate connection pool:** Uses max 5 connections to avoid blocking main queries
- **Fire-and-forget:** Errors are logged but don't throw

### Where Metrics Are Recorded

**Store Search Route:** `src/api/store/embeddings/search/route.ts`

```typescript
const requestStartTime = Date.now();

// Generate embedding (timed)
const embeddingStartTime = Date.now();
const embedding = await embedText(query);
const embeddingDuration = Date.now() - embeddingStartTime;

// Execute search (timed)
const searchStartTime = Date.now();
const searchResult = await semanticSearch({ embedding, limit, ... });
const searchDuration = Date.now() - searchStartTime;

const totalDuration = Date.now() - requestStartTime;

// Record metrics (non-blocking)
metricsRepository.recordSearch({
  query,
  query_length: query.length,
  embedding_dimensions: embedding.dimensions,
  embedding_generation_ms: embeddingDuration,
  elasticsearch_query_ms: searchDuration,
  total_duration_ms: totalDuration,
  results_count: hits.length,
  filters_applied: undefined,
  user_type: 'store',
}).catch(err => logger.error('[METRICS] Failed to record:', err));
```

**Admin Search Route:** `src/api/admin/embeddings/search/route.ts` (same pattern, `user_type: 'admin'`)

### Timing Strategy

Each search operation tracks three timing points:
1. **Embedding generation** - Time to call embedding service (local Python or OpenAI)
2. **Elasticsearch query** - Time for vector similarity search
3. **Total duration** - Full request including product hydration

This enables pinpointing performance bottlenecks: "Is embedding slow or is Elasticsearch slow?"

## Analytics & Queries

### Admin Dashboard API

**Endpoint:** `GET /admin/metrics?timeRange=24h`

**File:** `src/api/admin/metrics/route.ts`

**Query parameters:**
- `timeRange` - Time window to analyze (format: `<number><unit>`)
  - Units: `h` (hours), `d` (days), `w` (weeks)
  - Examples: `1h`, `24h`, `7d`, `30d`, `2w`
  - Default: `24h`

**Response structure:**

```json
{
  "time_range": "24h",
  "search": {
    "stats": [
      {
        "total_searches": 342,
        "avg_embedding_ms": 95,
        "avg_search_ms": 125,
        "avg_total_ms": 245,
        "p95_duration_ms": 380,
        "avg_results": 8,
        "slow_queries_count": 3,
        "user_type": "store"
      },
      {
        "total_searches": 28,
        "avg_embedding_ms": 120,
        "avg_search_ms": 180,
        "avg_total_ms": 350,
        "p95_duration_ms": 450,
        "avg_results": 15,
        "slow_queries_count": 1,
        "user_type": "admin"
      }
    ],
    "top_queries": [
      {
        "query": "comfortable running shoes",
        "search_count": 45,
        "avg_results": 8,
        "avg_duration_ms": 230
      }
    ],
    "slow_queries": [
      {
        "query": "winter jackets with hood waterproof",
        "total_duration_ms": 2340,
        "embedding_generation_ms": 150,
        "elasticsearch_query_ms": 2100,
        "results_count": 3,
        "user_type": "store",
        "timestamp": "2025-11-18T10:15:23.456Z"
      }
    ]
  }
}
```

**Key metrics explained:**
- `p95_duration_ms` - 95th percentile latency (95% of requests are faster than this)
- `slow_queries_count` - Queries exceeding 2000ms threshold
- `avg_*_ms` - Average duration for each phase

### Direct SQL Queries

You can query TimescaleDB directly for custom analysis:

```bash
# Connect to database
docker exec -it medusa-hovedopgave psql -U medusa_user -d medusa_hovedopgave
```

## Local Development Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 20+

# View analytics dashboard
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:9000/admin/metrics?timeRange=1h" | jq


## Performance Considerations

### Why Non-Blocking Metrics

Metrics recording uses `.catch()` wrapper to ensure failures don't break user requests:

```typescript
metricsRepository.recordSearch(metrics)
  .catch(err => logger.error('[METRICS] Failed to record:', err));
```

**Rationale:**
- Metric failure = no user impact
- Database down = searches still work
- Follows fail-safe principle

### Connection Pooling

The metrics repository uses a separate connection pool (`max: 5`) to avoid starving main application queries:

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,  // Separate from Medusa's main pool
});
```

### Indexing Strategy

Indexes optimize common queries:
- `idx_search_timestamp` - Time-range queries (default for dashboard)
- `idx_search_user_type` - Filter by admin vs store

Missing indexes? Check query performance:

```sql
EXPLAIN ANALYZE
SELECT * FROM search_metrics
WHERE user_type = 'store'
  AND timestamp > NOW() - INTERVAL '7 days';
```

Look for `Seq Scan` (bad) vs `Index Scan` (good).

## Data Retention & Cleanup

### Automatic Retention

TimescaleDB automatically deletes data older than 90 days:

```sql
SELECT add_retention_policy('search_metrics', INTERVAL '90 days', if_not_exists => TRUE);
```

**To change retention:**

```sql
-- Remove existing policy
SELECT remove_retention_policy('search_metrics');

-- Add new policy (e.g., 30 days)
SELECT add_retention_policy('search_metrics', INTERVAL '30 days');
```

### Manual Cleanup

```sql
-- Delete searches older than specific date
DELETE FROM search_metrics
WHERE timestamp < '2025-01-01';

-- Delete low-value data (single-character queries, likely typos)
DELETE FROM search_metrics
WHERE query_length < 2;
```

## Future Enhancements

### Planned Features

1. **Embedding metrics tracking** (schema ready, not yet instrumented)
   - Track product embedding generation performance
   - Monitor success/failure rates by provider (local vs OpenAI)
   
2. **Worker metrics** (schema ready, not yet instrumented)
   - Track indexing job processing times
   - Monitor queue depths and failure rates

3. **dashboard** - Visualize metrics with charts
4. **Alerting** - Slack/email notifications for slow queries (>2s)
5. **Session tracking** - Group queries into user sessions for behavior analysis
6. **A/B testing** - Compare local vs OpenAI embedding performance

### Contributing Metrics

When adding new metrics:

1. **Add table column** in `init-timescale.sql`
2. **Update TypeScript interface** in `metrics-repository.ts`
3. **Add to INSERT statement** in `recordSearch()`
4. **Document in this file**

Follow AGENTS.md principle: *"Keep edits minimal and scoped"*.

## Reference Links

- [TimescaleDB Documentation](https://docs.timescale.com/)
- [Hypertables Explained](https://docs.timescale.com/use-timescale/latest/hypertables/)
- [Time-Series Best Practices](https://docs.timescale.com/use-timescale/latest/schema-management/)

## Environment Variables
