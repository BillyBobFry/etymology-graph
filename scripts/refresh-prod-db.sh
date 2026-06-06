#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

env_file="$root_dir/.env.prod"
local_env_file="$root_dir/.env"
backup_dir="$root_dir/wikidata_downloads/backups"
skip_backup=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-backup)
      skip_backup=true
      shift
      ;;
    -h|--help)
      cat <<'USAGE'
Usage: pnpm db:refresh:prod [--skip-backup]

Destructively refreshes the production Railway database with data from local .env:
  1. backs up the current remote database with pg_dump
  2. creates a local data-only dump from .env
  3. truncates production graph/search tables
  4. restores the local data into .env.prod
  5. refreshes graph_edge_walk_mv
  6. compares key local and production row counts

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

if [[ ! -f "$local_env_file" ]]; then
  echo "Missing $local_env_file" >&2
  exit 1
fi

read_database_url() {
  node --input-type=module - "$1" <<'NODE'
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
}

PROD_DATABASE_URL="$(read_database_url "$env_file")"
LOCAL_DATABASE_URL="$(read_database_url "$local_env_file")"

if [[ -z "$PROD_DATABASE_URL" ]]; then
  echo "DATABASE_URL was not found in $env_file" >&2
  exit 1
fi

if [[ -z "$LOCAL_DATABASE_URL" ]]; then
  echo "DATABASE_URL was not found in $local_env_file" >&2
  exit 1
fi

command -v psql >/dev/null 2>&1 || {
  echo "psql is required to restore production data." >&2
  exit 1
}

command -v pg_dump >/dev/null 2>&1 || {
  echo "pg_dump is required to dump local data and back up production." >&2
  exit 1
}

command -v pg_restore >/dev/null 2>&1 || {
  echo "pg_restore is required to restore local data into production." >&2
  exit 1
}

mkdir -p "$backup_dir"
timestamp="$(date +%Y%m%d-%H%M%S)"

if [[ "$skip_backup" == false ]]; then
  backup_path="$backup_dir/railway-prod-before-local-data-restore-$timestamp.dump"
  echo "Backing up current production database to $backup_path..."
  pg_dump --format=custom --no-owner --no-acl --file "$backup_path" "$PROD_DATABASE_URL"
fi

local_dump_path="$backup_dir/local-data-restore-source-$timestamp.dump"
echo "Dumping local database data to $local_dump_path..."
pg_dump \
  --format=custom \
  --data-only \
  --no-owner \
  --no-acl \
  --exclude-table=graph_edge_walk_mv \
  --file "$local_dump_path" \
  "$LOCAL_DATABASE_URL"

echo "Truncating production data tables..."
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
TRUNCATE
  source_language_layer_matches,
  source_language_layer_refreshes,
  term_embeddings,
  graph_edges,
  lexical_entries,
  graph_nodes,
  languages
RESTART IDENTITY CASCADE;
SQL

echo "Restoring local data into production..."
pg_restore \
  --data-only \
  --no-owner \
  --no-acl \
  --dbname "$PROD_DATABASE_URL" \
  "$local_dump_path"

echo "Refreshing production graph_edge_walk_mv..."
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 -c "REFRESH MATERIALIZED VIEW graph_edge_walk_mv;"

counts_sql="
SELECT 'graph_edges' AS table_name, count(*) FROM graph_edges
UNION ALL
SELECT 'graph_edge_walk_mv', count(*) FROM graph_edge_walk_mv
UNION ALL
SELECT 'graph_nodes', count(*) FROM graph_nodes
UNION ALL
SELECT 'languages', count(*) FROM languages
UNION ALL
SELECT 'lexical_entries', count(*) FROM lexical_entries
UNION ALL
SELECT 'source_language_layer_matches', count(*) FROM source_language_layer_matches
UNION ALL
SELECT 'source_language_layer_refreshes', count(*) FROM source_language_layer_refreshes
UNION ALL
SELECT 'term_embeddings', count(*) FROM term_embeddings
ORDER BY table_name;
"

local_counts_path="$(mktemp)"
prod_counts_path="$(mktemp)"
trap 'rm -f "$local_counts_path" "$prod_counts_path"' EXIT

psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -F $'\t' -Atc "$counts_sql" > "$local_counts_path"
psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 -F $'\t' -Atc "$counts_sql" > "$prod_counts_path"

echo "Production refresh complete. Row counts:"
cat "$prod_counts_path"

if ! diff -u "$local_counts_path" "$prod_counts_path"; then
  echo "Production row counts differ from local after restore." >&2
  exit 1
fi

echo "Production row counts match local."
