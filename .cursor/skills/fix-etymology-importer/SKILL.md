---
name: fix-etymology-importer
description: Investigate and fix incorrect etymology graph edges from Wiktextract seed data. Use when the user flags a bad graph, ancestry API result, doublet result, seed entry, etymology_templates issue, or importer bug for a specific term such as en:wait, en:bat, en:bull, or en:character.
---

# Fix Etymology Importer Issues

## Goal

Turn a reported bad graph into a focused importer regression and a narrow fix. Prefer real Wiktextract seed evidence, graph preview output, and TDD over broad refactors or guessing from the API response alone.

## Workflow

1. Identify the target term as `{langCode}:{word}`. If the user gives only a word, infer the language only when context makes it obvious; otherwise ask.
2. Inspect the generated seed entry in `wikidata_downloads/seeds/popular-seed.jsonl` with a streaming script. Do not load the full raw Wiktextract dump.
3. Preview importer output for that exact entry with `previewEntry()` and list edge ids, edge types, template names, and uncertainty.
4. Compare three things before editing:
   - `etymology_text`: the human-readable source of relationship structure.
   - `etymology_templates`: the structured term anchors and template names.
   - Preview edges: what the importer currently stores.
5. State the suspected bug in graph terms, for example `en:wait -> non:veita` should be `enm:waiten -> non:veita`, or a comparison-only term should not create ancestry.
6. Add a focused failing test in `packages/importer/src/wiktextract.test.ts` before changing implementation. Prefer a small inline `WiktextractEntry` when the issue is a local prose/template pattern; add a trimmed real fixture under `packages/importer/src/fixtures/wiktextract/` when the embedded tree or neighborhood is too large.
7. Run `pnpm --filter @etymology-graph/importer test -- wiktextract.test.ts` and confirm the new test fails for the expected edge difference.
8. Make the smallest importer change that fixes the pattern. Keep template parsing and prose heuristics local to `packages/importer/src/wiktextract.ts` unless the bug is in shared traversal.
9. Add a guard test for the behavior that must remain valid when the heuristic is risky, such as real alternatives still branching or explicit later `Believed to be derived from...` prose still continuing a chain.
10. Re-run `pnpm --filter @etymology-graph/importer test -- wiktextract.test.ts`, then check lints on edited files.

## Interpretation Rules

- Treat `etymology_templates` as structured anchors, not a full graph. `args["1"]` is the current entry language; source language and term are usually `args["2"]` and `args["3"]`.
- Use `etymology_text` only to recover local structure around already-structured templates: sentence boundaries, prefixes like `Perhaps compare`, text between adjacent expansions, `or` / `alternatively`, and `both from`.
- Do not parse arbitrary prose into new nodes. If a term is only in prose and not in structured fields, call that out rather than inventing it.
- Prefer conservative ancestry. Comparison prose such as `compare`, `perhaps compare`, `possibly compare`, or `maybe compare` should not create normal ancestry edges.
- Preserve nuanced source metadata where possible: template name, uncertainty, originating entry id, and etymology number.
- For `etymon` tree issues, verify whether tree metadata is better or worse than flat templates. If the tree collapses affix/component groups into false ancestry, regression-test the bad edge directly and keep hidden affix groups out of the main chain.

## Common Patterns

- Missing template mapping: add a regression and map the template name, for example `lbor -> borrowed_from` or `uder -> derived_from`.
- False branch reset: narrow the prose heuristic, such as ignoring `or` inside parenthetical glosses.
- Comparison-only source: skip ancestry edges introduced by a comparison sentence prefix.
- Parallel sources: model `X and Y, both from Z` as sibling edges from the branch base, then shared ancestor edges from both siblings to `Z`.
- Homograph contamination: add tests around `traverseAncestors` and entry-aware traversal, not just preview edges.

## Useful Commands

```bash
pnpm --filter @etymology-graph/importer test -- wiktextract.test.ts
```

Use small Python or `tsx` scripts to stream `wikidata_downloads/seeds/popular-seed.jsonl` and print only the target entry. Avoid commands that dump huge JSON into chat; summarize graph-relevant fields when the entry is large.
