CREATE TABLE IF NOT EXISTS source_language_layer_refreshes (
  lang_code TEXT NOT NULL REFERENCES languages(code) ON DELETE CASCADE,
  ancestor_lang_code TEXT NOT NULL REFERENCES languages(code) ON DELETE CASCADE,
  max_depth INTEGER NOT NULL CHECK (max_depth >= 1),
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lang_code, ancestor_lang_code, max_depth)
);

CREATE TABLE IF NOT EXISTS source_language_layer_matches (
  lang_code TEXT NOT NULL,
  ancestor_lang_code TEXT NOT NULL,
  max_depth INTEGER NOT NULL CHECK (max_depth >= 1),
  entry_id TEXT NOT NULL REFERENCES lexical_entries(id) ON DELETE CASCADE,
  matched_ancestor_node_id TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL CHECK (depth >= 1),
  path_edge_ids TEXT[] NOT NULL,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lang_code, ancestor_lang_code, max_depth, entry_id),
  FOREIGN KEY (lang_code, ancestor_lang_code, max_depth)
    REFERENCES source_language_layer_refreshes(lang_code, ancestor_lang_code, max_depth)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS source_language_layer_matches_pair_entry_idx
  ON source_language_layer_matches (lang_code, ancestor_lang_code, max_depth, entry_id);

CREATE INDEX IF NOT EXISTS source_language_layer_matches_pair_depth_idx
  ON source_language_layer_matches (lang_code, ancestor_lang_code, max_depth, depth, matched_ancestor_node_id);
