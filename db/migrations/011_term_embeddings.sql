CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS term_embeddings (
  lang_code TEXT NOT NULL,
  normalized_word TEXT NOT NULL,
  word TEXT NOT NULL,
  model TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  embedded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lang_code, normalized_word, model)
);

CREATE INDEX IF NOT EXISTS term_embeddings_embedding_hnsw_idx
  ON term_embeddings
  USING hnsw (embedding vector_cosine_ops);
