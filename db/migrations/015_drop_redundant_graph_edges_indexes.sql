-- API traversal and atlas refreshes now read from graph_edge_walk_mv, so these raw-edge
-- lookup indexes only consume disk during imports and production restores.
DROP INDEX IF EXISTS graph_edges_from_type_declaring_idx;
DROP INDEX IF EXISTS graph_edges_from_declaring_type_idx;
DROP INDEX IF EXISTS graph_edges_from_node_entry_idx;
DROP INDEX IF EXISTS graph_edges_edge_type_idx;
