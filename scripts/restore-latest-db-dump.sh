#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

compose_file="$root_dir/docker-compose.prod.yml"
env_file="$root_dir/.env"
dump_path="${DUMP_PATH:-$root_dir/backups/latest.sql.gz}"

if [[ ! -f "$compose_file" ]]; then
  echo "Missing Compose file: $compose_file" >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  echo "Missing VPS environment file: $env_file" >&2
  exit 1
fi

if [[ ! -f "$dump_path" ]]; then
  echo "Missing database dump: $dump_path" >&2
  echo "Run scripts/copy-latest-db-dump-to-vps.sh locally first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-etymology_graph}"

echo "Restoring $dump_path into Docker Compose database '$POSTGRES_DB'."
echo "Stopping app while the database is replaced..."
docker compose -f "$compose_file" stop app

echo "Dropping and recreating database..."
docker compose -f "$compose_file" exec -T postgres dropdb --if-exists --force -U "$POSTGRES_USER" "$POSTGRES_DB"
docker compose -f "$compose_file" exec -T postgres createdb -U "$POSTGRES_USER" "$POSTGRES_DB"

echo "Restoring dump..."
gunzip -c "$dump_path" \
  | sed '/^SET transaction_timeout/d' \
  | docker compose -f "$compose_file" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "Starting app stack..."
docker compose -f "$compose_file" up -d

echo "Database restore complete."
