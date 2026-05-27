# Etymology Graph

Local-first web app for exploring etymological relationships from a Wiktionary/Wiktextract dump.

## Structure

- `apps/web`: Vue SPA for search, entry detail, and graph exploration.
- `apps/api`: Node/TypeScript API for graph queries.
- `packages/graph`: shared graph domain types and normalization helpers.
- `packages/importer`: streaming Wiktextract importer utilities.
- `db/migrations`: Postgres schema migrations.
- `wikidata_downloads`: local raw dump storage, ignored by git.

## Local Development

```bash
pnpm install
pnpm dev
```

Preview a small number of Wiktextract entries without loading the full dump:

```bash
pnpm import:sample
```

Extract a focused local seed file from the full JSONL dump:

```bash
pnpm seed:extract
```

Defaults use `SEED_PROFILE=core` and write known development words to
`wikidata_downloads/seeds/core-seed.jsonl`. Profiles live in
`packages/importer/src/seed-profiles.ts`; available profiles include `core`, `loanwords`, `doublets`,
`broadStress`, `highDescendantCandidates`, and `stress`.

Use a larger stress profile when you want to exercise the API and graph UI with thousands of imported
nodes:

```bash
pnpm seed:extract:stress
pnpm import:batch-preview:stress
pnpm import:db:stress
```

`SEED_TARGETS` can still add ad hoc words to a profile. Set `SEED_TARGETS_MODE=replace` when you want
to ignore the selected profile entirely.

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
pnpm seed:languages
pnpm import:db
```

`pnpm import:db` reads `.env`, defaults to `wikidata_downloads/seeds/core-seed.jsonl`, and writes its
resume checkpoint to `wikidata_downloads/checkpoints/import-db.json`.

`pnpm seed:languages` fetches Wiktionary's generated language list and upserts `code` to canonical-name
mappings into the `languages` table used by API graph responses.