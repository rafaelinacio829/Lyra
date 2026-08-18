#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$HOME/lyra}"
cd "$APP_DIR"
[ -f .env ] || { echo "Arquivo .env ausente. Execute deploy/install-vm.sh primeiro." >&2; exit 1; }
export NODE_ENV=production
exec pnpm start
