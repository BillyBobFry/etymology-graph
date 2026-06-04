CREATE INDEX IF NOT EXISTS term_embeddings_lang_model_idx
  ON term_embeddings (lang_code, model);
