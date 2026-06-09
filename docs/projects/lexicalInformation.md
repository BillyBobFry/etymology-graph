## Lexical Information MS1

MS1 enriches the existing term graph with lightweight dictionary context from Wiktextract. The goal is to make search results and graph nodes more informative by showing an IPA pronunciation, part of speech, and a short definition where the source JSONL provides them.

The core graph remains term-based. `graph_nodes` still represents a normalized language-plus-word node such as `en:orange`, which keeps search and graph traversal simple. Lexical details live in a separate `lexical_entries` table because definitions, pronunciations, parts of speech, and etymology sections belong to dictionary entries rather than to the coarse graph node itself.

## Scope

MS1 imports one lexical entry per Wiktextract record and stores:

- `pos`
- `etymology_number`
- the first displayable IPA pronunciation and label from `sounds[]`
- the first displayable gloss from `senses[].glosses`
- source line and byte offset metadata for debugging import behavior

The compact display columns are:

- `primary_ipa`
- `primary_ipa_label`
- `primary_gloss`

These columns let API queries cheaply attach a compact `lexicalSummary` to each returned graph node without asking the frontend to understand the full Wiktextract payload.

## Summary Selection

When multiple lexical entries exist for the same graph node, MS1 keeps the UI node-based and chooses a deterministic summary:

- first non-empty `primary_ipa`, ordered by `etymology_number` and `pos`
- first non-empty `primary_ipa_label`, using Wiktextract pronunciation tags like `Received-Pronunciation` or `General-American`
- first non-empty `primary_gloss`
- first non-empty `pos`
- total lexical entry count for the node

This is intentionally a summary, not a claim that the selected definition or pronunciation is the only valid one.

## UI Behavior

`TermSearchForm.vue` now shows richer search option descriptions:

```text
orange
English · /ˈɒɹ.ɪnd͡ʒ/ Received Pronunciation · noun · orange fruit
```

`GraphCanvas.vue` keeps visible graph labels compact so definitions do not clutter the layout. Clicking or keyboard-selecting a graph node opens a small detail card with the node's language, IPA, part of speech, definition, and a lexical entry count when multiple entries were imported.

## Intentional Non-Goals

MS1 does not persist full pronunciation arrays, sense arrays, or freeform etymology prose in `lexical_entries`. Add normalized child tables later if the app needs to query individual senses, filter by accent, search definitions, show source prose, or add pronunciation-specific features.

MS1 does not add audio playback, pronunciation preference settings, sense tabs, synonym/hypernym graphs, translations, or derived-term expansion.

## Shipped Follow-Ups

The homograph-identity project (see `docs/projects/homographNodeIdentity.md`) extended this layer:

- `/api/term-entries` exposes every lexical entry for a term, and `EntryChooser.vue` surfaces homograph entries in the UI.
- Ancestor, child, and doublet queries accept optional `pos` and `etymologyNumber` and pick a deterministic anchor entry when they are omitted.
- `graph_edges.declaring_entry_id` attributes each edge to the lexical entry that declared it. API traversal reads from `graph_edge_walk_mv`, which uses that provenance plus `default_ancestor_walk_candidate` to keep self-declared ancestry ahead of ambiguous ancestor-page descendant evidence.

## Later Follow-Up Ideas

- Promote `lexical_pronunciations` and `lexical_senses` to separate tables if filtering, search, or analytics need them.
- Add audio playback by persisting selected Wiktextract audio URLs in a purpose-built table.
- Add preferred pronunciation labels by locale, for example Received Pronunciation, General American, Australian, or regional variants.
- Add semantic "similar terms" from `term_embeddings` (see `docs/projects/termEmbeddings.md`) without making embeddings part of `lexical_entries` or `graph_nodes`.
