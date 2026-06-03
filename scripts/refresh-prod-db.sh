#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

env_file="$root_dir/.env.prod"
seed_path="$root_dir/wikidata_downloads/seeds/structured-ancestry-seed.jsonl"
checkpoint_path="$root_dir/wikidata_downloads/checkpoints/structured-ancestry-import-db.json"
backup_dir="$root_dir/wikidata_downloads/backups"
extract_seed=false
skip_backup=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --extract-seed)
      extract_seed=true
      shift
      ;;
    --skip-backup)
      skip_backup=true
      shift
      ;;
    -h|--help)
      cat <<'USAGE'
Usage: pnpm db:refresh:prod [--extract-seed] [--skip-backup]

Destructively refreshes the production Railway database from .env.prod:
  1. optionally regenerates wikidata_downloads/seeds/structured-ancestry-seed.jsonl
  2. backs up the current remote database with pg_dump
  3. drops and recreates the public schema
  4. reapplies db/migrations/*.sql
  5. imports language metadata
  6. imports the structured ancestry seed with a fresh checkpoint

Required confirmation:
  CONFIRM_PROD_DB_RESET=refresh-railway-prod pnpm db:refresh:prod
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "${CONFIRM_PROD_DB_RESET:-}" != "refresh-railway-prod" ]]; then
  echo "Refusing to clear the production database without explicit confirmation." >&2
  echo "Run with: CONFIRM_PROD_DB_RESET=refresh-railway-prod pnpm db:refresh:prod" >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file" >&2
  exit 1
fi

DATABASE_URL="$(
  node --input-type=module - "$env_file" <<'NODE'
import { readFileSync } from "node:fs";

const envPath = process.argv[2];
const contents = readFileSync(envPath, "utf8");
const line = contents
  .split(/\r?\n/u)
  .map((candidate) => candidate.trim())
  .find((candidate) => candidate.startsWith("DATABASE_URL=") || candidate.startsWith("export DATABASE_URL="));

if (!line) {
  process.exit(1);
}

const rawValue = line.replace(/^export\s+/u, "").replace(/^DATABASE_URL=/u, "").trim();
const quote = rawValue[0];
const value = (quote === '"' || quote === "'") && rawValue.endsWith(quote)
  ? rawValue.slice(1, -1)
  : rawValue;

process.stdout.write(value);
NODE
)"

if [[ -z "$DATABASE_URL" ]]; then
  echo "DATABASE_URL was not found in $env_file" >&2
  exit 1
fi

export DATABASE_URL

command -v psql >/dev/null 2>&1 || {
  echo "psql is required to reset and migrate the remote database." >&2
  exit 1
}

if [[ "$extract_seed" == true ]]; then
  echo "Regenerating structured ancestry seed..."
  pnpm seed:extract:structured-ancestry
fi

if [[ ! -f "$seed_path" ]]; then
  echo "Missing structured ancestry seed: $seed_path" >&2
  echo "Run again with --extract-seed, or run pnpm seed:extract:structured-ancestry first." >&2
  exit 1
fi

if [[ "$skip_backup" == false ]]; then
  command -v pg_dump >/dev/null 2>&1 || {
    echo "pg_dump is required for the pre-refresh backup. Install Postgres client tools or pass --skip-backup." >&2
    exit 1
  }

  mkdir -p "$backup_dir"
  backup_path="$backup_dir/railway-prod-$(date +%Y%m%d-%H%M%S).sql"
  echo "Backing up current production database to $backup_path..."
  pg_dump "$DATABASE_URL" > "$backup_path"
fi

echo "Dropping and recreating public schema on production..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
SQL

echo "Applying migrations..."
for migration in db/migrations/*.sql; do
  echo "  $migration"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "Importing language metadata..."
pnpm seed:languages

echo "Removing local structured ancestry import checkpoint..."
rm -f "$checkpoint_path"

echo "Importing structured ancestry graph data..."
pnpm import:db:structured

echo "Production refresh complete. Row counts:"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'languages' AS table_name, count(*) FROM languages
UNION ALL
SELECT 'graph_nodes', count(*) FROM graph_nodes
UNION ALL
SELECT 'lexical_entries', count(*) FROM lexical_entries
UNION ALL
SELECT 'graph_edges', count(*) FROM graph_edges
ORDER BY table_name;
SQL
