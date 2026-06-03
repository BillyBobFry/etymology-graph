CREATE INDEX IF NOT EXISTS graph_edges_from_type_declaring_idx
  ON graph_edges (from_node_id, edge_type, declaring_entry_id)
  INCLUDE (id, to_node_id, template_name);

CREATE INDEX IF NOT EXISTS graph_edges_from_declaring_type_idx
  ON graph_edges (from_node_id, declaring_entry_id, edge_type)
  INCLUDE (id, to_node_id, template_name);
