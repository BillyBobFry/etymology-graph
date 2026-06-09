CREATE INDEX IF NOT EXISTS source_language_layer_matches_entry_id_idx
  ON source_language_layer_matches (entry_id);

CREATE INDEX IF NOT EXISTS source_language_layer_matches_matched_ancestor_node_id_idx
  ON source_language_layer_matches (matched_ancestor_node_id);
