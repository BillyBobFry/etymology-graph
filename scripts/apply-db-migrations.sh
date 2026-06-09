#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

compose_file="$root_dir/docker-compose.prod.yml"
env_file="$root_dir/.env"
migrations_dir="$root_dir/db/migrations"
baseline_through="${MIGRATION_BASELINE_THROUGH:-016}"

if [[ ! -f "$compose_file" ]]; then
  echo "Missing Compose file: $compose_file" >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  echo "Missing VPS environment file: $env_file" >&2
  exit 1
fi

if [[ ! -d "$migrations_dir" ]]; then
  echo "Missing migrations directory: $migrations_dir" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-etymology_graph}"

psql_exec() {
  docker compose -f "$compose_file" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

sql_literal() {
  printf "'%s'" "$(printf "%s" "$1" | sed "s/'/''/g")"
}

version_for_migration() {
  local filename="$1"
  local version="${filename%%_*}"

  if [[ ! "$filename" =~ ^[0-9]{3}_[A-Za-z0-9_]+\.sql$ ]]; then
    echo "Invalid migration filename: $filename" >&2
    exit 1
  fi

  printf "%s" "$version"
}

echo "Ensuring Postgres is healthy..."
docker compose -f "$compose_file" up -d postgres

echo "Ensuring schema_migrations ledger exists..."
psql_exec <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

ledger_count="$(psql_exec -Atc "SELECT count(*) FROM schema_migrations;")"
has_existing_schema="$(psql_exec -Atc "SELECT to_regclass('public.lexical_entries') IS NOT NULL;")"

if [[ "$ledger_count" == "0" && "$has_existing_schema" == "t" && -n "$baseline_through" ]]; then
  echo "Existing schema detected with an empty ledger; baselining migrations through $baseline_through."

  for migration in "$migrations_dir"/*.sql; do
    filename="$(basename "$migration")"
    version="$(version_for_migration "$filename")"

    if [[ "$version" > "$baseline_through" ]]; then
      continue
    fi

    psql_exec -c "INSERT INTO schema_migrations (version, filename) VALUES ($(sql_literal "$version"), $(sql_literal "$filename")) ON CONFLICT (version) DO NOTHING;"
  done
fi

for migration in "$migrations_dir"/*.sql; do
  filename="$(basename "$migration")"
  version="$(version_for_migration "$filename")"
  applied="$(psql_exec -Atc "SELECT 1 FROM schema_migrations WHERE version = $(sql_literal "$version");")"

  if [[ "$applied" == "1" ]]; then
    echo "Skipping already-applied migration $filename."
    continue
  fi

  echo "Applying migration $filename..."

  {
    printf "BEGIN;\n"
    while IFS= read -r line || [[ -n "$line" ]]; do
      printf "%s\n" "$line"
    done < "$migration"
    printf "\nINSERT INTO schema_migrations (version, filename) VALUES (%s, %s);\n" "$(sql_literal "$version")" "$(sql_literal "$filename")"
    printf "COMMIT;\n"
  } | psql_exec
done

echo "Database migrations are up to date."
