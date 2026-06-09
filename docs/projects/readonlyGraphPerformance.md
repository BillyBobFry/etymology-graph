## Readonly Graph Performance

The app database is effectively readonly during normal use. Wiktextract data is imported in batches, then the API serves graph reads over a stable dataset until the next import or refresh. That makes Postgres materialized views, pgvector term embeddings, and other denormalized read models a good fit: we can pay refresh cost after imports instead of paying repeated join cost inside every request.

This note captures the current design discussion around recursive CTE performance, `declaring_entry_id`, and denormalized graph views.

## Current Problem

Ancestor, descendant, doublet, and source-language queries walk graph-shaped relational tables. The normalized model is useful for import correctness and source metadata, but recursive CTEs can become expensive because each step repeatedly joins and filters across:

- `graph_edges`
- `graph_nodes`
- `lexical_entries`
- language metadata and display summary tables

A denormalized materialized view would precompute a flatter edge shape for traversal so recursive queries can scan indexed rows that already contain the facts they need.

## Declaring Entry Is Provenance

`graph_edges.declaring_entry_id` means "the lexical entry whose Wiktextract record declared this edge." It is edge provenance, not necessarily the selected descendant entry for a traversal.

That distinction matters because the structured importer often imports edges from ancestor pages:

- An ancestor page's `descendants` list can create an edge from a descendant term to the ancestor term.
- The edge direction is still child-to-source, for ancestor traversal.
- The entry that declared the edge is the ancestor entry, because that is where the evidence came from.

This is different from the old mental model behind `originating_entry_id`, where import often walked from a descendant entry down toward its ancestors and could carry the selected descendant entry as traversal context.

The rename to `declaring_entry_id` makes the current meaning explicit. It should remain useful for:

- source attribution and debugging
- scoped reimport deletion
- preserving duplicate edge assertions from different Wiktextract entries
- denormalized provenance columns in read models

It should not be treated as a complete answer to entry-scoped traversal.

## Homograph Caveat

The `en:bank` graph shows the gap. The DB can have a single imported lexical entry for `en:bank` while descendant-owned edges from ancestor pages also point through the same coarse node. If traversal assumes "one imported entry at this node means the term is unambiguous," it can mix the financial-bank path with the riverbank or shore path.

So the issue is not that `declaring_entry_id` is useless. The issue is that declaring-entry provenance is not the same as applicability to the currently selected lexical entry.

The default policy should prefer self-declared ancestry. Ambiguous descendant-list edges can remain in the graph as evidence, but the public ancestor walk should exclude them when any self-declared ancestor edge exists from the same node. Only return ambiguous edges when there are no self-declared ancestor edges from that node.

This does not perfectly solve homographs; the source data may not contain enough structure to know which descendant lexical entry an ancestor page meant. It does make the ambiguity explicit and prevents ancestor-declared descendant evidence from overriding self-declared ancestry.

## Materialized View Direction

A materialized view is still feasible and likely valuable. The readonly nature of the DB makes it easier than in a transactional app because the view can be refreshed after imports.

A first traversal view could denormalize one row per stored edge with columns such as:

- `edge_id`
- `from_node_id`, `from_lang_code`, `from_normalized_word`, `from_word`
- `to_node_id`, `to_lang_code`, `to_normalized_word`, `to_word`
- `edge_type`
- `template_name`
- `uncertain`
- `declaring_entry_id`
- `declaring_entry_node_id`
- `declaring_entry_lang_code`
- `declaring_entry_word`
- `declaring_entry_pos`
- `declaring_entry_etymology_number`
- `from_entry_count`
- `to_entry_count`
- `is_self_declared_edge`
- `is_descendant_list_edge`
- `is_ambiguous_descendant_edge`
- `has_self_declared_ancestor_edge_from_node`
- `default_ancestor_walk_candidate`

Indexes should match traversal access patterns, especially:

- `(from_node_id, edge_type)`
- `(from_node_id, edge_type, declaring_entry_id)`
- `(to_node_id, edge_type)`
- `(declaring_entry_id)`

The view should expose facts needed by traversal and include `default_ancestor_walk_candidate` for the default policy: use self-declared ancestor edges first, and use ambiguous descendant-list edges only when the same `from_node_id` has no self-declared ancestor edge.

## Suggested Read Models

Start small and only add projections when a query needs them:

- `graph_edge_walk_mv`: denormalized edge rows for recursive graph walks.
- `term_embeddings`: durable pgvector cache for semantic similar-term queries, keyed by `(lang_code, normalized_word, model)` rather than `graph_nodes.id` so it survives graph rebuilds.
- `node_entry_summary_mv`: one row per node with entry counts and available entry ids.
- `ancestor_edge_candidates_mv`: prefiltered ancestor-walkable edge types, if `graph_edge_walk_mv` is still too broad.

For word-lineage atlas work, a separate promoted-pair result cache may be more useful than a global reachability table. The product only needs curated pairs to be fast, not every possible language pair.

## API Usage

`PostgresGraphRepository` reads edge relationships from `graph_edge_walk_mv` for public graph endpoints. Ancestor-style recursive walks filter on `default_ancestor_walk_candidate`, so self-declared ancestry wins over ambiguous ancestor-page descendant evidence. Child-term queries still use the view for denormalized edge facts, but they do not apply the ancestor default-candidate filter because they intentionally surface descendant relationships.

## Refresh Strategy

Because the DB is readonly between imports:

1. Run structured seed extraction.
2. Run structured DB import.
3. `import:db:structured` refreshes `graph_edge_walk_mv` and prunes isolated graph nodes after full batch processing.
4. Refresh any curated source-language layer matches.
5. Run `pnpm embeddings:refresh:english` to embed new or changed English terms.
6. Serve API traffic from the refreshed read models.

For local development, the import script's plain `REFRESH MATERIALIZED VIEW graph_edge_walk_mv` is enough. Limited smoke runs with `IMPORT_LIMIT_RECORDS` skip this refresh and isolated-node pruning by default; set `IMPORT_REFRESH_GRAPH_EDGE_WALK=true` or `IMPORT_PRUNE_ISOLATED_GRAPH=true` to force either step explicitly. If refresh time becomes visible in deployment, use a build-then-swap table strategy or `REFRESH MATERIALIZED VIEW CONCURRENTLY` where unique indexes allow it.

Embedding refreshes are content-hash based and can be rerun after imports. The first implementation is English-only and uses OpenAI `text-embedding-3-small`; keep provider-specific generation in importer/admin jobs rather than API request handling.

## Next Steps

1. Add a focused `en:bank` regression that documents the selected ambiguity policy.
2. Compare `EXPLAIN ANALYZE` for the materialized-view recursive CTEs and tune indexes.
3. Consider `node_entry_summary_mv` if repeated lexical summary lateral joins remain expensive.
4. Keep `declaring_entry_id` in the view as provenance, but do not describe it as traversal identity.
