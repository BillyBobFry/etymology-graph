## Lexical Information MS1

MS1 enriches the existing term graph with lightweight dictionary context from Wiktextract. The goal is to make search results and graph nodes more informative by showing an IPA pronunciation, part of speech, and a short definition where the source JSONL provides them.

The core graph remains term-based. `graph_nodes` still represents a normalized language-plus-word node such as `en:orange`, which keeps search and graph traversal simple. Lexical details live in a separate `lexical_entries` table because definitions, pronunciations, parts of speech, and etymology sections belong to dictionary entries rather than to the coarse graph node itself.

## Scope

MS1 imports one lexical entry per Wiktextract record and stores:

- `pos`
- `etymology_number`
- `etymology_text`
- all IPA pronunciation records from `sounds[]`, including Wiktextract `tags`, notes, audio file names, and audio URLs
- all displayable glosses from `senses[].glosses`, plus normalized and raw tags
- source line and byte offset metadata for debugging import behavior

The table also stores derived summary columns:

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

MS1 does not add lexical-entry selection. Users still search for and open graph nodes by language and term, not by `pos` or `etymology_number`.

MS1 does not filter graph traversal by lexical entry or etymology section. The imported edges still attach to graph nodes, with `etymology_number` preserved on edges where available.

MS1 does not normalize pronunciations and senses into separate relational tables. Full pronunciation and sense data is stored as JSONB on `lexical_entries`, with summary columns for current UI/API needs. Split this later if the app needs to query individual senses, filter by accent, search definitions, or add pronunciation-specific features.

MS1 does not add audio playback, pronunciation preference settings, sense tabs, synonym/hypernym graphs, translations, or derived-term expansion.

## Later Follow-Up Ideas

- Add a term detail API that returns full lexical entries for a selected node.
- Let users choose a specific lexical entry when a term has multiple etymologies or parts of speech.
- Thread selected lexical entry IDs into ancestor/descendant traversal so unrelated homograph histories do not merge.
- Promote `lexical_pronunciations` and `lexical_senses` to separate tables if filtering, search, or analytics need them.
- Add audio playback using the preserved Wiktextract audio URLs.
- Add preferred pronunciation labels by locale, for example Received Pronunciation, General American, Australian, or regional variants.
