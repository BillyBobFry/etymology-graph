#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="$root_dir/backups"

VPS_HOST="${VPS_HOST:-vps.lingraphic.com}"
VPS_USER="${VPS_USER:-will}"
VPS_PORT="${VPS_PORT:-22}"
VPS_DEPLOY_PATH="${VPS_DEPLOY_PATH:-/home/$VPS_USER/etymology-graph}"
REMOTE_DUMP_DIR="${REMOTE_DUMP_DIR:-$VPS_DEPLOY_PATH/backups}"

if [[ ! -d "$backup_dir" ]]; then
  echo "Missing local backup directory: $backup_dir" >&2
  exit 1
fi

latest_dump="$(
  python3 - "$backup_dir" <<'PY'
from pathlib import Path
import sys

backup_dir = Path(sys.argv[1])
dumps = sorted(backup_dir.glob("*.sql.gz"), key=lambda path: path.stat().st_mtime, reverse=True)

if not dumps:
    sys.exit(1)

print(dumps[0])
PY
)" || {
  echo "No .sql.gz dumps found in $backup_dir" >&2
  exit 1
}

printf -v quoted_remote_dump_dir "%q" "$REMOTE_DUMP_DIR"

echo "Copying latest dump to $VPS_USER@$VPS_HOST:$REMOTE_DUMP_DIR/latest.sql.gz"
echo "Source: $latest_dump"

ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" "mkdir -p $quoted_remote_dump_dir"
scp -P "$VPS_PORT" "$latest_dump" "$VPS_USER@$VPS_HOST:$REMOTE_DUMP_DIR/latest.sql.gz"

echo "Copied dump. On the VPS, run:"
echo "  cd $VPS_DEPLOY_PATH && pnpm db:restore:latest-vps"
