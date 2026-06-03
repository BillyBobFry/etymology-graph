-- Pins each graph edge to the entry that declared it so traversal cannot cross unrelated homograph histories.
-- The next import run repopulates everything with the new edge id shape `${from}:${type}:${to}:from:${entryId}`
-- and the declaring_entry_id column; truncating cascades graph_nodes -> lexical_entries + graph_edges.
TRUNCATE graph_nodes CASCADE;

ALTER TABLE graph_edges
  ADD COLUMN declaring_entry_id TEXT NOT NULL REFERENCES lexical_entries (id) ON DELETE CASCADE;

CREATE INDEX graph_edges_declaring_entry_id_idx
  ON graph_edges (declaring_entry_id);

CREATE INDEX graph_edges_from_node_entry_idx
  ON graph_edges (from_node_id, declaring_entry_id);
