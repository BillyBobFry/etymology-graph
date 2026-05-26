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

Defaults write known development words to `wikidata_downloads/seeds/core-seed.jsonl`. Override with
`SEED_TARGETS=en:bread,en:beer`, `SEED_LIMIT_PER_TARGET=2`, or `SEED_OUTPUT_PATH=...`.

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