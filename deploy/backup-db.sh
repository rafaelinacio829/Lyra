#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$HOME/lyra}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
mkdir -p "$BACKUP_DIR"
if [ -z "${DATABASE_URL:-}" ] && [ -f "$APP_DIR/.env" ]; then set -a; . "$APP_DIR/.env"; set +a; fi
case "${DATABASE_URL:-}" in
  mysql://*|mysql2://*)
    command -v mysqldump >/dev/null || { echo "mysqldump não encontrado." >&2; exit 1; }
    stamp=$(date +%Y%m%d-%H%M%S)
    mysqldump --single-transaction --routines --triggers "$DATABASE_URL" > "$BACKUP_DIR/lyra-$stamp.sql"
    echo "Backup criado em $BACKUP_DIR/lyra-$stamp.sql"
    ;;
  *) echo "DATABASE_URL deve apontar para MySQL/MariaDB para o backup atual." >&2; exit 1;;
esac
