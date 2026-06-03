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

Generate the structured ancestry seed from committed seed-word inputs and UI coverage terms:

```bash
pnpm seed:extract:structured-ancestry
pnpm import:batch-preview:structured
pnpm import:db:structured
```

The structured ancestry extractor reads committed seed-word lists from
`data/seed-words/thousand-most-common-words/` and `data/seed-words/corpora/`, adds public UI coverage
terms, streams the full Wiktextract dump, and writes
`wikidata_downloads/seeds/structured-ancestry-seed.jsonl`. The common-word files are normalized from
the MIT-licensed `SMenigat/thousand-most-common-words` dataset. The Corpora files are a reviewed
English allowlist from the CC0-licensed `dariusk/corpora` dataset; see
`data/seed-words/corpora/manifest.json` for included upstream paths and keys. Each word-list file can
be a compact array:

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

Exercise resumable batch processing against the structured ancestry seed:

```bash
pnpm import:batch-preview:structured
```

This writes a checkpoint to `wikidata_downloads/checkpoints/structured-ancestry-preview.json` so later
runs resume from the last committed byte offset.

Import the generated seed nodes and edges into Postgres:

```bash
set -a; source .env; set +a
psql "$DATABASE_URL" -f db/migrations/001_initial_graph.sql
psql "$DATABASE_URL" -f db/migrations/002_languages.sql
psql "$DATABASE_URL" -f db/migrations/003_lexical_entries.sql
psql "$DATABASE_URL" -f db/migrations/004_edge_entry_attribution.sql
pnpm seed:languages
pnpm import:db:structured
```

Apply every numbered migration in `db/migrations/` in order. Migration `004` adds the
`graph_edges.declaring_entry_id` provenance field and truncates `graph_nodes` so reapplying it
against an existing DB forces a full reimport. Migration `010` creates `graph_edge_walk_mv`, the
denormalized edge read model used by the API to apply the default ambiguity policy.

`pnpm import:db:structured` reads `.env`, defaults to
`wikidata_downloads/seeds/structured-ancestry-seed.jsonl`, and writes its resume checkpoint to
`wikidata_downloads/checkpoints/structured-ancestry-import-db.json`. It refreshes
`graph_edge_walk_mv` after full batch processing so API reads see the imported graph. Limited runs with
`IMPORT_LIMIT_RECORDS` skip that refresh by default; set `IMPORT_REFRESH_GRAPH_EDGE_WALK=true` to force
it.

`pnpm seed:languages` fetches Wiktionary's generated language list and upserts `code` to canonical-name
mappings into the `languages` table used by API graph responses.