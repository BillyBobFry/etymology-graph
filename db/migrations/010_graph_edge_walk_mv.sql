DROP MATERIALIZED VIEW IF EXISTS graph_edge_walk_mv;

CREATE MATERIALIZED VIEW graph_edge_walk_mv AS
WITH edge_facts AS (
  SELECT
    graph_edges.id AS edge_id,
    graph_edges.id,
    graph_edges.from_node_id,
    from_node.lang_code AS from_lang_code,
    from_node.word AS from_word,
    from_node.normalized_word AS from_normalized_word,
    graph_edges.to_node_id,
    to_node.lang_code AS to_lang_code,
    to_node.word AS to_word,
    to_node.normalized_word AS to_normalized_word,
    graph_edges.edge_type,
    graph_edges.source,
    graph_edges.etymology_number,
    graph_edges.template_name,
    graph_edges.uncertain,
    graph_edges.raw_source,
    graph_edges.created_at,
    graph_edges.declaring_entry_id,
    declaring_entry.node_id AS declaring_entry_node_id,
    declaring_entry.lang_code AS declaring_entry_lang_code,
    declaring_entry.word AS declaring_entry_word,
    declaring_entry.normalized_word AS declaring_entry_normalized_word,
    declaring_entry.pos AS declaring_entry_pos,
    declaring_entry.etymology_number AS declaring_entry_etymology_number,
    declaring_entry.primary_gloss AS declaring_entry_primary_gloss,
    COALESCE(from_entry_counts.entry_count, 0) AS from_entry_count,
    COALESCE(to_entry_counts.entry_count, 0) AS to_entry_count,
    declaring_entry.node_id = graph_edges.from_node_id AS is_self_declared_edge,
    graph_edges.template_name = 'descendants' AS is_descendant_list_edge,
    graph_edges.template_name = 'descendants'
      AND declaring_entry.node_id <> graph_edges.from_node_id AS is_ambiguous_descendant_edge,
    graph_edges.edge_type IN ('inherited_from', 'derived_from', 'borrowed_from', 'descendant_of')
      AS is_ancestor_edge_type
  FROM graph_edges
  JOIN graph_nodes from_node
    ON from_node.id = graph_edges.from_node_id
  JOIN graph_nodes to_node
    ON to_node.id = graph_edges.to_node_id
  JOIN lexical_entries declaring_entry
    ON declaring_entry.id = graph_edges.declaring_entry_id
  LEFT JOIN (
    SELECT node_id, COUNT(*) AS entry_count
    FROM lexical_entries
    GROUP BY node_id
  ) from_entry_counts
    ON from_entry_counts.node_id = graph_edges.from_node_id
  LEFT JOIN (
    SELECT node_id, COUNT(*) AS entry_count
    FROM lexical_entries
    GROUP BY node_id
  ) to_entry_counts
    ON to_entry_counts.node_id = graph_edges.to_node_id
)
SELECT
  edge_facts.*,
  BOOL_OR(edge_facts.is_ancestor_edge_type AND edge_facts.is_self_declared_edge)
    OVER (PARTITION BY edge_facts.from_node_id) AS has_self_declared_ancestor_edge_from_node,
  edge_facts.is_ancestor_edge_type
    AND (
      NOT edge_facts.is_ambiguous_descendant_edge
      OR NOT BOOL_OR(edge_facts.is_ancestor_edge_type AND edge_facts.is_self_declared_edge)
        OVER (PARTITION BY edge_facts.from_node_id)
    ) AS default_ancestor_walk_candidate
FROM edge_facts;

CREATE UNIQUE INDEX graph_edge_walk_mv_edge_id_idx
  ON graph_edge_walk_mv (edge_id);

CREATE INDEX graph_edge_walk_mv_from_type_idx
  ON graph_edge_walk_mv (from_node_id, edge_type);

CREATE INDEX graph_edge_walk_mv_from_type_declaring_idx
  ON graph_edge_walk_mv (from_node_id, edge_type, declaring_entry_id);

CREATE INDEX graph_edge_walk_mv_to_type_idx
  ON graph_edge_walk_mv (to_node_id, edge_type);

CREATE INDEX graph_edge_walk_mv_declaring_entry_idx
  ON graph_edge_walk_mv (declaring_entry_id);

CREATE INDEX graph_edge_walk_mv_default_ancestor_idx
  ON graph_edge_walk_mv (from_node_id, edge_type, declaring_entry_id)
  WHERE default_ancestor_walk_candidate;
