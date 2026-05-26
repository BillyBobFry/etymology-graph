CREATE TABLE IF NOT EXISTS lexical_entries (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES graph_nodes (id) ON DELETE CASCADE,
  lang_code TEXT NOT NULL,
  word TEXT NOT NULL,
  normalized_word TEXT NOT NULL,
  pos TEXT,
  etymology_number INTEGER,
  primary_ipa TEXT,
  primary_ipa_label TEXT,
  primary_gloss TEXT,
  pronunciations JSONB NOT NULL DEFAULT '[]'::jsonb,
  senses JSONB NOT NULL DEFAULT '[]'::jsonb,
  etymology_text TEXT,
  source_line_number INTEGER,
  source_byte_offset BIGINT,
  source TEXT NOT NULL DEFAULT 'wiktextract',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lexical_entries_node_id_idx
  ON lexical_entries (node_id);

CREATE INDEX IF NOT EXISTS lexical_entries_lang_normalized_word_idx
  ON lexical_entries (lang_code, normalized_word);
