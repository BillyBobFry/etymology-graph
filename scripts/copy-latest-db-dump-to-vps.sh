#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

backup_dir="$root_dir/backups"
local_env_file="$root_dir/.env"

VPS_HOST="${VPS_HOST:-vps.lingraphic.com}"
VPS_USER="${VPS_USER:-will}"
VPS_PORT="${VPS_PORT:-22}"
VPS_DEPLOY_PATH="${VPS_DEPLOY_PATH:-/home/$VPS_USER/etymology-graph}"
REMOTE_DUMP_DIR="${REMOTE_DUMP_DIR:-$VPS_DEPLOY_PATH/backups}"

mkdir -p "$backup_dir"

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

if [[ -f "$local_env_file" ]]; then
  LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-$(read_database_url "$local_env_file" || true)}"
else
  LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-}"
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
latest_dump="$backup_dir/local-db-$timestamp.sql.gz"

echo "Creating local database dump at $latest_dump..."

if [[ -n "${LOCAL_DATABASE_URL:-}" ]] && command -v pg_dump >/dev/null 2>&1; then
  pg_dump --no-owner --no-acl "$LOCAL_DATABASE_URL" | gzip > "$latest_dump"
else
  command -v docker >/dev/null 2>&1 || {
    echo "Either pg_dump or docker is required to create the local database dump." >&2
    exit 1
  }

  docker compose up -d postgres
  docker exec etymology-graph-postgres \
    pg_dump --no-owner --no-acl -U postgres -d etymology_graph \
    | gzip > "$latest_dump"
fi

printf -v quoted_remote_dump_dir "%q" "$REMOTE_DUMP_DIR"

echo "Copying latest dump to $VPS_USER@$VPS_HOST:$REMOTE_DUMP_DIR/latest.sql.gz"
echo "Source: $latest_dump"

ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" "mkdir -p $quoted_remote_dump_dir"
scp -P "$VPS_PORT" "$latest_dump" "$VPS_USER@$VPS_HOST:$REMOTE_DUMP_DIR/latest.sql.gz"

echo "Copied dump. On the VPS, run:"
echo "  cd $VPS_DEPLOY_PATH && pnpm db:restore:latest-vps"
