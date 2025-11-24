CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Search performance metrics
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

-- Embedding generation metrics
CREATE TABLE IF NOT EXISTS embedding_metrics (
  id BIGSERIAL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  product_id VARCHAR(255) NOT NULL,
  query TEXT,
  generation_ms INTEGER NOT NULL,
  embedding_dimensions INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('local', 'openai')),
  context VARCHAR(50) NOT NULL CHECK (context IN ('product_indexing', 'search_query', 'bulk_operation'))

);

SELECT create_hypertable('embedding_metrics', 'timestamp', if_not_exists => TRUE);
CREATE INDEX idx_embedding_timestamp ON embedding_metrics (timestamp DESC);
CREATE INDEX idx_embedding_product ON embedding_metrics (product_id, timestamp DESC);
CREATE INDEX idx_embedding_provider ON embedding_metrics (provider, success, timestamp DESC);

-- Worker performance metrics
CREATE TABLE IF NOT EXISTS worker_metrics (
  id BIGSERIAL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  operation VARCHAR(100) NOT NULL,
  product_id VARCHAR(255),
  job_id VARCHAR(255),
  duration_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  attempts INTEGER
);

SELECT create_hypertable('worker_metrics', 'timestamp', if_not_exists => TRUE);
CREATE INDEX idx_worker_timestamp ON worker_metrics (timestamp DESC);
CREATE INDEX idx_worker_operation ON worker_metrics (operation, success, timestamp DESC);

-- Retention: Keep detailed data for 90 days
SELECT add_retention_policy('search_metrics', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('embedding_metrics', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('worker_metrics', INTERVAL '90 days', if_not_exists => TRUE);