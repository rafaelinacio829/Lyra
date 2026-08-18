#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/lyra}"
cd "$APP_DIR"

command -v node >/dev/null || { echo "Node.js 22+ é obrigatório." >&2; exit 1; }
command -v pnpm >/dev/null || { echo "pnpm é obrigatório. Instale com: corepack enable && corepack prepare pnpm@10.4.1 --activate" >&2; exit 1; }

mkdir -p data
[ -f .env ] || cp .env.example .env
pnpm install --frozen-lockfile
pnpm build
pnpm db:push

echo "Instalação concluída. Revise $APP_DIR/.env e execute deploy/start-vm.sh."
