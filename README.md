# Etymology Graph

Etymology Graph is a web app for exploring where words come from and how they relate
across languages. It imports structured Wiktionary data from Wiktextract into Postgres, then serves
search, ancestor, descendant, doublet, similar-term, and neighborhood graph views through a Vue app.

You can try the current public version at [lingraphic.com](https://lingraphic.com).

## What It Does

- Turns Wiktionary/Wiktextract entries into a graph of terms, lexical entries, and etymological
  relationships.
- Lets users search for a word, choose between homograph entries, and inspect ancestor or descendant
  paths.
- Keeps graph import and traversal local-first so the app can be developed against a local Postgres
  database and a local Wiktextract dump.
- Uses Postgres plus pgvector for the graph read model and optional similar-term embeddings.

## Repository Layout

- `apps/web`: Vue SPA for search, entry detail, and graph exploration.
- `apps/api`: Node/Fastify API for graph queries.
- `packages/graph`: shared graph domain types, IDs, normalization, and traversal logic.
- `packages/importer`: streaming Wiktextract seed extraction and import utilities.
- `db/migrations`: Postgres schema migrations.
- `data/seed-words`: committed seed inputs used to choose which entries to extract.
- `wikidata_downloads`: local raw dump, generated seeds, and checkpoints. This directory is ignored by
  git because the raw data file is about 21GB.

## Local Setup

Use the Node version pinned in `.tool-versions` and run workspace commands with `pnpm`.

Install dependencies, copy the local environment defaults, and start Postgres:

```bash
pnpm install
cp .env.example .env
pnpm db:start
```

Apply every numbered migration in `db/migrations/` in order, then import language metadata:

```bash
set -a; source .env; set +a
for migration in db/migrations/*.sql; do psql "$DATABASE_URL" -f "$migration"; done
pnpm seed:languages
```

Start the API and web app:

```bash
pnpm dev
```

The default local database URL is `postgres://postgres:postgres@localhost:5432/etymology_graph`.
If local `psql` is not installed, you can run it through the Docker container:

```bash
for migration in db/migrations/*.sql; do
  docker exec -i etymology-graph-postgres psql -U postgres -d etymology_graph < "$migration"
done
```

For deployment notes, see `docs/deployment.md`.

## Getting Wiktextract Data

The main raw input is the English Wiktionary Wiktextract JSONL dump from Kaikki:
[kaikki.org/dictionary/rawdata.html](https://kaikki.org/dictionary/rawdata.html). Download the raw
JSONL data file and save it here. If you download a compressed `.gz` file, decompress it first:

```text
wikidata_downloads/raw-wiktextract-data.jsonl
```

The file is intentionally gitignored because it is about 21GB. Treat it as JSONL and process it with
streaming tools only; do not load the whole file into memory.

After the raw dump is in place, generate a smaller structured ancestry seed and import it into the
database:

```bash
pnpm seed:extract:structured-ancestry
pnpm import:batch-preview:structured
pnpm import:db:structured
```

`pnpm seed:extract:structured-ancestry` streams the raw dump, starts from committed seed lists and
public UI coverage terms, and writes `wikidata_downloads/seeds/structured-ancestry-seed.jsonl`.
`pnpm import:batch-preview:structured` validates resumable batch processing against that generated
seed. `pnpm import:db:structured` writes nodes, lexical entries, and graph edges into Postgres, then
refreshes the `graph_edge_walk_mv` materialized view after a full import.

The import scripts write checkpoints under `wikidata_downloads/checkpoints/`. If you regenerate the
seed from scratch, delete or change the matching checkpoint before reimporting, otherwise the importer
may resume after records that no longer match the generated file.

## Data Sources

Most graph facts come from structured data extracted from the English edition of Wiktionary by
Wiktextract. The importer prefers fields that expose structure, especially:

- `etymon` trees and rendered etymology-tree rows.
- `descendants` and nested descendant lists.
- `derived` lists.
- selected ancestry templates as seed-expansion hints.

The committed seed inputs come from `data/seed-words/thousand-most-common-words/` and
`data/seed-words/corpora/`. The common-word files are normalized from the MIT-licensed
`SMenigat/thousand-most-common-words` dataset. The Corpora files are a reviewed English allowlist from
the CC0-licensed `dariusk/corpora` dataset; see `data/seed-words/corpora/manifest.json` for the exact
upstream paths and keys.

## Known Data Caveats

This project treats the graph as an exploratory reading aid, not as an authoritative linguistic
database. Some accepted limitations come from the source data itself, and some come from deliberate
import choices:

- Wiktionary is collaboratively edited and varies by language, entry, and editor convention.
- Wiktextract exposes a lot of structure, but not every etymology is represented as clean machine
  data. Freeform `etymology_text` is kept for display and investigation, but it is not the primary
  source of graph edges.
- Flat ancestry templates are used to find more records, not to build arbitrary edge chains. They
  often point to skipped ancestors rather than adjacent parent terms.
- Descendant lists can contain spelling variants, partial lattices, uncertain relationships, and
  language-specific editorial shortcuts. The structured importer intentionally keeps only the first
  item per language at each descendant sibling level to reduce noisy false fan-out.
- Graph nodes are keyed by language and normalized word, so multiple homographs can share a node.
  Lexical entries and entry-aware traversal reduce cross-contamination, but ambiguous entries still
  require care.
- Uncertain, alternative, or incomplete etymologies may appear as missing edges, conservative edges, or
  competing paths rather than one definitive lineage.
- The default local import is seed-driven. It is designed to make a useful graph from a bounded subset
  of the 21GB dump, not to import every Wiktionary entry blindly.
