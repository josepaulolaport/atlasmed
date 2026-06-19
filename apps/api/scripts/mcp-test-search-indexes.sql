-- Explore search performance: trigram indexes on base tables (not heavy aggregate views).
-- Run: psql "$DATABASE_URL" -f apps/api/scripts/mcp-test-search-indexes.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_mcp_facilities_trade_name_trgm
  ON mcp_test.facilities USING gin (trade_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_mcp_facilities_legal_name_trgm
  ON mcp_test.facilities USING gin (legal_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_mcp_facilities_neighborhood_trgm
  ON mcp_test.facilities USING gin (neighborhood gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_mcp_municipalities_name_trgm
  ON mcp_test.municipalities USING gin (municipality_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_mcp_professionals_full_name_trgm
  ON mcp_test.professionals USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_mcp_facilities_facility_id
  ON mcp_test.facilities (facility_id);

CREATE INDEX IF NOT EXISTS idx_mcp_professionals_professional_id
  ON mcp_test.professionals (professional_id);

ANALYZE mcp_test.facilities;
ANALYZE mcp_test.municipalities;
ANALYZE mcp_test.professionals;
