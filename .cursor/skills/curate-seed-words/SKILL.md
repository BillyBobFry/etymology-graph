---
name: curate-seed-words
description: Curate committed seed word datasets for the etymology graph, especially Corpora concept seeds, exclusions, translations, README counts, and popular seed extraction validation. Use when changing data/seed-words, Corpora allowlists, exclusions.json, multilingual seed concepts, or popular seed inputs.
---

# Curate Seed Words

## Goal

Keep committed seed data useful, reviewable, and reproducible. Prefer explicit source files and denylist edits over hidden one-off agent judgment.

## Corpora Workflow

When updating `data/seed-words/corpora/`:

1. Treat `manifest.json` as the reviewed upstream allowlist and curation policy.
2. Keep `concepts.json` in concept format:

```json
{
  "source": { "name": "dariusk/corpora curated English seed concepts" },
  "concepts": [
    {
      "id": "alligator",
      "categories": ["animals/common"],
      "languages": {
        "en": ["alligator"],
        "fr": ["alligator"],
        "de": ["Alligator"]
      }
    }
  ]
}
```

3. Apply deterministic source cleanup before judgment: single-token alphabetic English concepts only.
4. Apply `exclusions.json` as the reviewed denylist. It is a plain JSON array of strings so the user can delete keepers easily.
5. Be harsh when proposing new exclusions, but do not silently remove ambiguous single-token terms except through `exclusions.json`.
6. Use model knowledge for translation generation when the user asks for translations. Do not scan `wikidata_downloads/raw-wiktextract-data.jsonl` unless the user explicitly asks for source-derived translations.
7. Preserve `languages.en` for every concept; add translations under ISO language codes.

## Loader Contract

`packages/importer/src/popular-word-lists.ts` must support:

- explicit `{ languageCode, words }` files used by frequency-list data
- concept files with `concepts[].languages`
- optional per-directory `exclusions.json`

When changing this contract, update `packages/importer/src/popular-word-lists.test.ts`.

## Counts And Docs

After changing Corpora data, update `data/seed-words/corpora/README.md`:

- total concepts
- active concepts after `exclusions.json`
- active language targets
- translated active concepts, if translations are present
- category counts when source concept membership changes

## Validation

Run focused checks:

```bash
pnpm --filter @etymology-graph/importer test -- popular-word-lists.test.ts
pnpm --filter @etymology-graph/importer typecheck
```

For a loader count check:

```bash
pnpm --filter @etymology-graph/importer exec tsx -e "void import('./src/popular-word-lists.ts').then(async ({ loadPopularWordTargets }) => { const result = await loadPopularWordTargets('../../data/seed-words/corpora'); console.log(JSON.stringify({ targetCount: result.targetSpecs.length, files: result.files }, null, 2)); });"
```
