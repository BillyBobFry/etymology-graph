# Etymology Graph

Local-first web app for exploring etymological relationships from a Wiktionary/Wiktextract dump.

## Structure

- `apps/web`: Vue SPA for search, entry detail, and graph exploration.
- `apps/api`: Node/TypeScript API for graph queries.
- `packages/graph`: shared graph domain types and normalization helpers.
- `packages/importer`: streaming Wiktextract importer utilities.
- `db/migrations`: Postgres schema migrations.
- `wikidata_downloads`: local raw dump storage, ignored by git.

## Deployment

The first production shape is a Postgres 16 database and one app container that serves both the
Node/Fastify API and the Vite-built static web app. See `docs/deployment.md` for Railway setup,
environment variables, database bootstrap commands, container builds, and smoke checks.

## Local Development

```bash
pnpm install
pnpm dev
```

Preview a small number of Wiktextract entries without loading the full dump:

```bash
pnpm import:sample
```

Extract the committed common-word seed data:

```bash
pnpm seed:extract:popular
pnpm import:batch-preview:popular
pnpm import:db:popular
```

The popular extractor reads committed seed-word lists from
`data/seed-words/thousand-most-common-words/` and `data/seed-words/corpora/`, streams the full
Wiktextract dump once, and writes matching entries to `wikidata_downloads/seeds/popular-seed.jsonl`.
The common-word files are normalized from the MIT-licensed `SMenigat/thousand-most-common-words`
dataset. The Corpora files are a reviewed English allowlist from the CC0-licensed `dariusk/corpora`
dataset; see `data/seed-words/corpora/manifest.json` for included upstream paths and keys. You can
point `POPULAR_WORDS_DIRS` at comma-separated directories when testing local-only lists. Each
word-list file can be a compact array:

```json
["the", "be", "and"]
```

or an object with metadata:

```json
{
  "languageCode": "en",
  "source": {
    "name": "frequency-list/top-1000",
    "license": "MIT"
  },
  "words": ["the", "be", "and"]
}
```

To grow a more connected production graph without importing the full Wiktextract dump, run influential-root
expansion:

```bash
pnpm seed:extract:prod
pnpm import:batch-preview:prod
pnpm import:db:prod
```

Production expansion starts from the committed popular seed targets, writes
`wikidata_downloads/seeds/prod-seed.jsonl`, and persists an inspectable frontier report to
`wikidata_downloads/checkpoints/prod-expansion-frontier.json`. It also loads public UI coverage terms
from `apps/web/src/features/terms/starterQueries.ts` and
`apps/web/src/features/soundChanges/soundChanges.ts`, so starter searches and editorial examples are
included as initial targets. It first follows structured graph nodes into hub languages such as Latin,
Ancient Greek, Sanskrit, Avestan, Proto-Indo-European, Proto-Germanic, and Proto-West Germanic. Once a
matched target is itself in a hub language, it can add bounded neighboring targets in configured outward
languages so roots produce useful sibling branches rather than isolated ancestry chains. Explicit `cog`
templates also enqueue allowed cognate terms as high-signal neighbors without treating them as ancestry
edges. Hub-language forms get a few extra follow-up passes by default, so a visible term that stops at a
proto-form can still cause that proto-form to be imported and connected upstream. Tune it with
`UI_SEED_COVERAGE_MODULES`, `EXPANSION_HUB_LANG_CODES`, `EXPANSION_ROOT_OUTWARD_LANG_CODES`,
`EXPANSION_COGNATE_LANG_CODES`, `EXPANSION_ENQUEUE_COGNATES`, `EXPANSION_MAX_DEPTH`,
`EXPANSION_MAX_HUB_DEPTH`, `EXPANSION_MAX_TARGETS`, and `EXPANSION_MAX_DISCOVERED_TARGETS_PER_MATCH`.

Exercise resumable batch processing against a seed JSONL file:

```bash
pnpm import:batch-preview
```

This writes a checkpoint to `wikidata_downloads/checkpoints/batch-preview.json` so later runs resume
from the last committed byte offset.

Import the generated seed nodes and edges into Postgres:

```bash
set -a; source .env; set +a
psql "$DATABASE_URL" -f db/migrations/001_initial_graph.sql
psql "$DATABASE_URL" -f db/migrations/002_languages.sql
psql "$DATABASE_URL" -f db/migrations/003_lexical_entries.sql
psql "$DATABASE_URL" -f db/migrations/004_edge_entry_attribution.sql
pnpm seed:languages
pnpm import:db
```

Apply every numbered migration in `db/migrations/` in order. Migration `004` adds the
`graph_edges.originating_entry_id` attribution that keeps homograph histories apart and truncates
`graph_nodes` so reapplying it against an existing DB forces a full reimport.

`pnpm import:db` reads `.env`, defaults to `wikidata_downloads/seeds/core-seed.jsonl`, and writes its
resume checkpoint to `wikidata_downloads/checkpoints/import-db.json`.

`pnpm seed:languages` fetches Wiktionary's generated language list and upserts `code` to canonical-name
mappings into the `languages` table used by API graph responses.