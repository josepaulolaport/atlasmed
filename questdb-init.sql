-- QuestDB Initial Schema for AtlasMed API Observability
-- Run this in QuestDB UI (http://localhost:9000) after starting the container

-- ============================================================================
-- API Request Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_logs (
  -- Symbols (indexed, low cardinality)
  level SYMBOL CAPACITY 16 CACHE,
  method SYMBOL CAPACITY 16 CACHE,
  route SYMBOL CAPACITY 256 CACHE,
  service SYMBOL CAPACITY 16 CACHE,
  environment SYMBOL CAPACITY 8 CACHE,
  
  -- String columns
  message STRING,
  request_id STRING,
  user_id STRING,
  error STRING,
  context STRING,
  
  -- Numeric columns
  status_code INT,
  duration_ms DOUBLE,
  
  -- Timestamp (required for time-series)
  timestamp TIMESTAMP
) timestamp(timestamp) PARTITION BY DAY WAL;

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_logs_level ON api_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_method ON api_logs(method);
CREATE INDEX IF NOT EXISTS idx_logs_route ON api_logs(route);
CREATE INDEX IF NOT EXISTS idx_logs_request_id ON api_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON api_logs(user_id);

-- ============================================================================
-- API Metrics Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_metrics (
  -- Symbols
  metric_name SYMBOL CAPACITY 128 CACHE,
  service SYMBOL CAPACITY 16 CACHE,
  environment SYMBOL CAPACITY 8 CACHE,
  method SYMBOL CAPACITY 16 CACHE,
  route SYMBOL CAPACITY 256 CACHE,
  status SYMBOL CAPACITY 16 CACHE,
  
  -- Value
  value DOUBLE,
  
  -- Additional tags (optional)
  tags STRING,
  
  -- Timestamp
  timestamp TIMESTAMP
) timestamp(timestamp) PARTITION BY DAY WAL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_metrics_name ON api_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_method ON api_metrics(method);
CREATE INDEX IF NOT EXISTS idx_metrics_route ON api_metrics(route);

-- ============================================================================
-- Database Query Logs (optional, for detailed database performance tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS db_queries (
  -- Query info
  query_type SYMBOL CAPACITY 16 CACHE,  -- SELECT, INSERT, UPDATE, DELETE
  table_name SYMBOL CAPACITY 64 CACHE,
  
  -- Performance
  duration_ms DOUBLE,
  rows_affected INT,
  
  -- Context
  request_id STRING,
  user_id STRING,
  query_text STRING,
  
  -- Metadata
  service SYMBOL CAPACITY 16 CACHE,
  environment SYMBOL CAPACITY 8 CACHE,
  
  -- Timestamp
  timestamp TIMESTAMP
) timestamp(timestamp) PARTITION BY DAY WAL;

CREATE INDEX IF NOT EXISTS idx_db_query_type ON db_queries(query_type);
CREATE INDEX IF NOT EXISTS idx_db_table ON db_queries(table_name);

-- ============================================================================
-- Sample Queries (for testing)
-- ============================================================================

-- View recent logs
-- SELECT * FROM api_logs ORDER BY timestamp DESC LIMIT 100;

-- Error rate by route
-- SELECT 
--   route,
--   COUNT(*) as total,
--   SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as errors,
--   (SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as error_rate
-- FROM api_logs
-- WHERE timestamp > dateadd('h', -1, now())
-- GROUP BY route
-- ORDER BY error_rate DESC;

-- Response time percentiles
-- SELECT 
--   route,
--   approx_percentile(duration_ms, 0.5) as p50,
--   approx_percentile(duration_ms, 0.95) as p95,
--   approx_percentile(duration_ms, 0.99) as p99
-- FROM api_logs
-- WHERE timestamp > dateadd('h', -1, now())
-- GROUP BY route;

-- Requests per minute
-- SELECT 
--   timestamp_floor('m', timestamp) as minute,
--   COUNT(*) as requests
-- FROM api_logs
-- WHERE timestamp > dateadd('h', -1, now())
-- SAMPLE BY 1m;
