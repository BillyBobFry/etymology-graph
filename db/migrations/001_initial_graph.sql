CREATE TABLE languages (
  code TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'wiktionary',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE graph_nodes (
  id TEXT PRIMARY KEY,
  lang_code TEXT NOT NULL,
  word TEXT NOT NULL,
  normalized_word TEXT NOT NULL,
  display_lang TEXT,
  source TEXT NOT NULL DEFAULT 'wiktextract',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX graph_nodes_lang_normalized_word_idx
  ON graph_nodes (lang_code, normalized_word);

CREATE TABLE lexical_entries (
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

CREATE INDEX lexical_entries_node_id_idx
  ON lexical_entries (node_id);

CREATE INDEX lexical_entries_lang_normalized_word_idx
  ON lexical_entries (lang_code, normalized_word);

CREATE TABLE graph_edges (
  id TEXT PRIMARY KEY,
  from_node_id TEXT NOT NULL REFERENCES graph_nodes (id) ON DELETE CASCADE,
  to_node_id TEXT NOT NULL REFERENCES graph_nodes (id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'wiktextract',
  etymology_number INTEGER,
  template_name TEXT,
  uncertain BOOLEAN NOT NULL DEFAULT false,
  raw_source JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX graph_edges_from_node_id_idx
  ON graph_edges (from_node_id);

CREATE INDEX graph_edges_to_node_id_idx
  ON graph_edges (to_node_id);

CREATE INDEX graph_edges_edge_type_idx
  ON graph_edges (edge_type);
