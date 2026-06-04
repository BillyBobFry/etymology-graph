CREATE INDEX IF NOT EXISTS graph_edge_walk_mv_from_lang_normalized_candidate_idx
  ON graph_edge_walk_mv (from_lang_code, from_normalized_word, from_node_id)
  WHERE default_ancestor_walk_candidate;
