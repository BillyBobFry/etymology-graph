---
name: fix-etymology-importer
description: Investigate and fix incorrect etymology graph edges from Wiktextract seed data. Use when the user flags a bad graph, ancestry API result, doublet result, seed entry, etymology_templates issue, or importer bug for a specific term such as en:wait, en:bat, en:bull, or en:character.
---

# Fix Etymology Importer Issues

## Goal

Turn a reported bad graph into a focused importer regression and a narrow fix. Prefer real Wiktextract seed evidence, graph preview output, and TDD over broad refactors or guessing from the API response alone.

## Workflow

1. Identify the target term as `{langCode}:{word}`. If the user gives only a word, infer the language only when context makes it obvious; otherwise ask.
2. Inspect the generated seed entry in `wikidata_downloads/seeds/structured-ancestry-seed.jsonl` with a streaming script. Do not load the full raw Wiktextract dump.
3. If the entry is missing, inspect `wikidata_downloads/checkpoints/structured-ancestry-frontier.json` to see whether the target was never enqueued, enqueued but `not_found`, or skipped by caps/depth.
4. Preview importer output for that exact entry with `previewStructuredEntry()` and list edge ids, edge types, template names, and uncertainty. Use `previewEntry()` only when comparing legacy behavior.
5. Compare four things before editing:
   - `etymology_templates`: seed-expansion hints and etymon-tree inputs
   - `descendants` / `derived`: structured graph edge sources
   - structured preview edges: what the importer currently stores
   - current DB edges, grouped by `declaring_entry_id`
   - `graph_edge_walk_mv` rows for the same node, especially `is_ambiguous_descendant_edge` and `default_ancestor_walk_candidate`
6. State the suspected bug in graph terms, for example `en:king` should not fan out through every Middle English spelling variant, or `fro:trois -> la:trēs` is missing because a rendered etymon tree was ignored.
7. Add a focused failing test in `packages/importer/src/wiktextract.test.ts` before changing implementation. Prefer a small inline `WiktextractEntry` when the issue is local; add a trimmed real fixture when the embedded tree or descendant neighborhood is too large.
8. Run `pnpm --filter @etymology-graph/importer test -- wiktextract.test.ts` and confirm the new test fails for the expected edge difference.
9. Make the smallest importer or seed-extractor change that fixes the pattern.
10. Re-run `pnpm --filter @etymology-graph/importer test -- wiktextract.test.ts`, then check lints on edited files.

## Interpretation Rules

- Treat flat `etymology_templates` as seed-expansion hints, not graph edges. `args["1"]` is the current entry language; source language and term are usually `args["2"]` and `args["3"]`.
- Do not interpret multiple flat ancestry templates as a chain. Each item is target-relative to the current entry and may skip intermediate ancestors, so `inh`/`der`/`bor` lists must not become adjacent graph edges.
- Use flat ancestry templates to enqueue ancestor records in `extract-structured-ancestry-seed.ts`; do not reintroduce direct flat-template graph edges beyond the existing single unambiguous source-template fallback without an explicit new source of adjacency evidence.
- Use `etymon` tree templates as graph input when they expose embedded metadata or rendered `Etymology tree` rows.
- Use `etymology_text` only for explanation/source display and fallback investigation. Do not parse arbitrary prose into graph edges.
- Do not parse arbitrary prose into new nodes. If a term is only in prose and not in structured fields, call that out rather than inventing it.
- Prefer conservative ancestry. Comparison prose such as `compare`, `perhaps compare`, `possibly compare`, or `maybe compare` should not create normal ancestry edges.
- Preserve nuanced source metadata where possible: template name, uncertainty, declaring entry id, and etymology number.
- At each descendant/derived sibling level, import only the first item per `lang_code` to avoid spelling-variant fan-out. Regression-test noisy cases such as `en:bread` and `en:king`.
- Seed target matching may use diacritic-stripped lookup, such as `la:trēs` matching raw `la:tres`; graph node identity must still preserve the record/template spelling.

## Common Patterns

- Missing seed ancestor: inspect the structured ancestry frontier and add/adjust template-hint extraction in `extract-structured-ancestry-seed.ts`.
- Missing DB edge with records present: inspect `previewStructuredEntry()` for etymon-tree, descendants, derived, affix, or compound extraction gaps.
- Noisy descendant ancestry: first check whether repeated same-language descendant variants are being imported.
- Diacritic title mismatch: add a seed-matching regression rather than changing graph node normalization.
- Homograph contamination: check whether the source data is ambiguous descendant-list evidence, then add tests around `traverseAncestors`, `graph_edge_walk_mv.default_ancestor_walk_candidate`, and entry-aware traversal, not just preview edges.

## Useful Commands

```bash
pnpm --filter @etymology-graph/importer test -- wiktextract.test.ts
pnpm seed:extract:structured-ancestry
pnpm import:db:structured
```

Use small Python or `tsx` scripts to stream `wikidata_downloads/seeds/structured-ancestry-seed.jsonl` and print only the target entry. Avoid commands that dump huge JSON into chat; summarize graph-relevant fields when the entry is large.
