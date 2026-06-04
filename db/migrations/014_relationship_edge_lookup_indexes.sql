CREATE INDEX IF NOT EXISTS graph_edge_walk_mv_doublet_same_language_idx
  ON graph_edge_walk_mv (from_lang_code, to_lang_code, to_node_id, declaring_entry_id)
  WHERE edge_type = 'doublet_of';

CREATE INDEX IF NOT EXISTS graph_edge_walk_mv_cognate_from_idx
  ON graph_edge_walk_mv (from_node_id)
  INCLUDE (to_node_id, declaring_entry_id)
  WHERE edge_type = 'cognate_with';

CREATE INDEX IF NOT EXISTS graph_edge_walk_mv_cognate_to_idx
  ON graph_edge_walk_mv (to_node_id)
  INCLUDE (from_node_id, declaring_entry_id)
  WHERE edge_type = 'cognate_with';
