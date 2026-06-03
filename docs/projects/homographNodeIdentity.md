## Homograph Node Identity Problem

The current graph model keys term nodes by language code plus normalized word/form, for example `en:ice`, `enm:is`, or `la:natio`. That is useful for simple lookup and traversal, but it collapses homographs and spelling-identical forms that belong to different lexical entries, parts of speech, or etymology sections.

This has become a production-blocking data quality issue. The graph can cross from one etymological history into an unrelated one whenever two histories share the same language-plus-word node.

## Current Model Context

`graph_nodes` represents coarse term identity: language plus normalized word. Lexical metadata is imported separately into `lexical_entries`, including `pos`, `etymology_number`, `etymology_text`, pronunciations, definitions, and source offsets.

Edges preserve some source metadata, including `templateName` and sometimes `etymologyNumber`, but graph traversal is still node-based. It does not currently keep traversal within a selected lexical entry, etymology section, part of speech, or source component.

This means lexical metadata can tell us that multiple entries exist, but the graph itself still behaves as if all matching spellings in a language are one etymological node.

## Evidence From Broken Graphs

### `en:element`

The original `element` issue was a flat-template parsing bug. Wiktextract had two prose clauses:

- noun: `English element <- Middle English element <- Old French element <- Latin elementum`
- verb: `English element <- Middle English elementen`

The importer previously chained every flat etymology template in one continuous sequence, producing a false `la:elementum -> enm:elementen` edge. This has a focused importer regression now.

### `en:elephant`

`elephant` exposed a related parsing issue around same-sentence alternatives. The source says the Greek etymon is believed to derive from an Afroasiatic form such as Proto-Berber `*eḷu` or Egyptian `ꜣbw`.

The importer first produced `ber-pro:*eḷu -> egy:ꜣbw`, then after a partial fix produced direct English edges to both candidates. The current intended importer output keeps the candidates attached below the Greek etymon:

```text
en:elephant -> enm:elefant -> fro:elefant -> la:elephantus -> grc:ἐλέφᾱς
grc:ἐλέφᾱς -> ber-pro:*eḷu
grc:ἐλέφᾱς -> egy:ꜣbw
```

This has a real-entry fixture and inline edge snapshot.

### `en:nation`

`nation` showed that a UI/API graph is a merged neighborhood, not just one Wiktextract entry. The graph included edges from:

- the English entry `en:nation`
- expanded source entries such as `la:natio`
- descendant lists from Latin and French entries
- neighboring entries such as `fr:nation`, `de:Nation`, and `it:nazione`

A multi-entry fixture now exists to snapshot de-duplicated importer edge output across a trimmed `nation` neighborhood. That fixture did not reproduce suspicious UI edges such as `fr:nation -> de:nation`, which suggests some remaining issues may live in DB/API traversal or graph query behavior rather than `previewEntry()` conversion alone.

### `en:ice`

`ice` is the clearest homograph collision.

The single `en:ice` importer output is clean:

```text
en:ice -> enm:is -> ang:īs -> gmw-pro:*īs -> gem-pro:*īsą -> ine-pro:*h₁eyh-
```

The rendered graph also includes a separate “to be / is” chain:

```text
ang:is -> gmw-pro:*ist -> gem-pro:*isti -> ine-pro:*h₁ésti / *h₁es-
```

That second branch is not the etymology of ice. It appears because the graph can traverse through spelling-identical nodes such as `enm:is` / `ang:is` from unrelated entries. This is not explained by stale database data; the database was cleared before import. It is a consequence of coarse node identity and traversal across merged homographs.

## Current Regression Coverage

Importer regressions live in `packages/importer/src/wiktextract.test.ts` and use Vitest inline snapshots of compact edge IDs.

Real Wiktextract-derived fixtures live under `packages/importer/src/fixtures/wiktextract/`:

- `en-element.json`
- `en-elephant.json`
- `en-nation-neighborhood.json`

Fixtures may be a single trimmed Wiktextract entry or an array of entries for merged-neighborhood cases. The project rule in `.cursor/rules/data-import.mdc` now says future broken graph reports should add fixtures before changing importer behavior.

## Important Distinction

`previewEntry(entry)` tests only importer conversion for one Wiktextract entry. The multi-entry helper in the importer tests can approximate merged import output by flattening and de-duplicating edge IDs across entries.

Neither test layer fully simulates:

- database upsert conflict behavior
- query-time graph traversal
- depth limits
- lexical summary selection
- frontend graph display

The `ice` issue likely requires testing and fixing beyond `previewEntry()`, because the individual `en:ice` entry converts correctly while the merged graph crosses into an unrelated homograph component.

## Problem Statement For Next Design Pass

The project needs a way to prevent unrelated homograph histories from merging during graph import, storage, query traversal, or display. The current language-plus-normalized-word node identity is too coarse for production-quality etymology graphs.

Any future design discussion should preserve the evidence above and account for:

- spelling-identical terms with unrelated etymologies
- multiple parts of speech for the same language and word
- multiple `etymology_number` sections
- descendant-list edges versus template-derived ancestry edges
- expanded seed neighborhoods that import several entries sharing the same visible term
- user-facing display that may still want to group or label related spellings without allowing false traversal

## Resolution: Option B (Edge Ownership + Entry-Aware Traversal)

The project shipped Option B from the design pass: keep coarse `graph_nodes` identity, but attribute every edge to the lexical entry that declared it and traverse a denormalized edge read model with an "allowed entry set" rooted at the chosen anchor entry.

### Schema

- `graph_edges` carries `declaring_entry_id`, a `NOT NULL` FK to `lexical_entries(id)` with `ON DELETE CASCADE`.
- Edge IDs include the declaring entry, formatted as `${fromNodeId}:${edgeType}:${toNodeId}:from:${declaringEntryId}`. The same ancestor link declared by two different entries is therefore two distinct edge rows.
- Indexes exist on `graph_edges (declaring_entry_id)` and `graph_edges (from_node_id, declaring_entry_id)`.
- Migration `db/migrations/004_edge_entry_attribution.sql` adds the column, indexes, and `TRUNCATE graph_nodes CASCADE` to force a reimport with the new edge id shape.
- `graph_edge_walk_mv` denormalizes edge, node, and declaring-entry facts for API reads. Its `default_ancestor_walk_candidate` flag applies the current ambiguity policy for ancestor-style traversal.

### Importer

- `previewEntry` (in `packages/importer/src/wiktextract.ts`) computes the declaring entry id once per Wiktextract entry and threads it through template, tree, and descendants edge construction via `makeGraphEdgeId`.
- `upsertGraphBatch` (in `packages/importer/src/postgres.ts`) writes `declaring_entry_id` on insert and conflict update.
- `deleteStaleRootAncestryEdges` is scoped by `(from_node_id, declaring_entry_id)` so reimporting one entry never deletes another entry's edges out of a shared homograph node.
- DB import scripts refresh `graph_edge_walk_mv` after full batch processing so API reads see the newly imported graph. Limited runs with `IMPORT_LIMIT_RECORDS` skip refresh by default.

### API Traversal (Rule v5)

`apps/api/src/postgres-graph-repository.ts` implements three CTEs used by `findAncestors`, `findChildTerms`, and `findDoublets`:

- `anchor_entry` picks the lexical entry to traverse from. Inputs are `langCode` + `normalizedWord` plus optional `pos` and `etymologyNumber`. When unspecified, ordering is lowest `etymology_number` then alphabetic `pos` then entry id, which is stable across requests.
- `anchor_resolved` falls back to the bare graph node when no lexical entry exists for the term (intermediate proto-forms imported only as graph nodes still resolve). The walk records `entry_scoped = (entry_id IS NOT NULL)` and skips the declaring-entry filter when `entry_scoped` is false.
- `ancestor_walk` (recursive) only follows `graph_edge_walk_mv` rows whose `declaring_entry_id` is in `allowed_entry_ids` and whose `default_ancestor_walk_candidate` is true. At each visited node `N`, additional entries homed at `N` join the allowed set under Rule v5 when either (a) they are the only entry homed at `N`, or (b) their first candidate ancestor edge from `N` lands on the same target as an already-allowed entry's edge from `N`. The seed edge join in the SQL mirrors `expandAllowedEntries` in `packages/graph/src/index.ts`.

`findDoublets` builds a candidate set whose ancestor edges meet the seed's allowed set at a shared ancestor. Candidates pass only when the shared ancestor has no homograph divergence at all (single outgoing ancestor edge), or when the candidate's own outgoing edge from that ancestor lands on the same node as the seed's. That guard is what keeps `en:is` out of `en:ice`'s doublet list despite both sharing `enm:is`.

`findChildTerms` is more permissive: it reads from `graph_edge_walk_mv` but does not apply the ancestor default-candidate filter. It includes edges declared by the seed entry's own descendants list, edges self-declared by descendant entries homed at the from-node, and (for entry-less seeds) every incoming edge.

### Pure Reference Implementation And Tests

- `packages/graph/src/index.ts` exposes `traverseAncestors(nodes, edges, allowedEntryIds, maxDepth)` plus `expandAllowedEntries`, `indexEntriesByNode`, `indexEdgesByFromNode`, and `indexEdgesByEntryFromNode`. The SQL `ancestor_walk` CTE intentionally mirrors that function so the rule lives in one place.
- `packages/importer/src/wiktextract.test.ts` adds `traverseAncestors against merged neighborhoods` covering `en-ice-neighborhood.json` (`en:ice` noun + `en:is` verb). The tests assert that ancestor traversal from each seed stays on its own chain and never reaches the other's `gem-pro` form.
- Existing importer snapshots were regenerated to include the new edge id format.

### API And Frontend Surface

- `GraphEdge` (in `@etymology-graph/graph`) now carries `declaringEntryId`. Ancestor, child, and doublet query schemas accept optional `pos` and `etymologyNumber`.
- The new `/api/term-entries?langCode=...&word=...` endpoint returns every lexical entry for a term so the frontend can offer a chooser. The repository method is `listTermEntries`.
- `apps/web` adds `useTermEntriesQuery`, `useTermEntrySelection`, and `EntryChooser.vue`. `EtymologyView.vue` and `DoubletsView.vue` render the chooser whenever a term has multiple entries and sync `pos` / `etym` query params into ancestor / doublet requests.

### Verification

- `pnpm test:importer` covers both the regenerated importer snapshots and the new `traverseAncestors` cross-entry regressions.
- Live API checks against the dev server confirm: `en:ice` ancestors do not touch the verb-be chain, `en:is` (verb, etymology 1) ancestors stay on `*ist` / `*isti`, `en:wine` ancestors resolve through the graph-node fallback, `en:shirt` doublets surface `en:skirt`, and `en:ice` doublets returns `null` instead of falsely pairing with `en:is`.
