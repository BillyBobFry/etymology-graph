CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Wrap unaccent in an immutable function so Postgres can use it in search indexes.
CREATE OR REPLACE FUNCTION search_unaccent(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURN unaccent(value);

CREATE INDEX graph_nodes_search_unaccent_trgm_idx
  ON graph_nodes USING GIN (search_unaccent(normalized_word) gin_trgm_ops);
