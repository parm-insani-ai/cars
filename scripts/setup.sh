#!/usr/bin/env bash
# One-shot dev setup: bring up Postgres, push schema, generate client, seed.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example. Edit it to add ANTHROPIC_API_KEY."
fi

# Ensure DATABASE_URL points at the docker-compose Postgres
if ! grep -q "^DATABASE_URL=.*localhost:5432" .env.local; then
  sed -i.bak 's|^DATABASE_URL=.*|DATABASE_URL="postgresql://revline:revline@localhost:5432/revline?schema=public"|' .env.local || true
fi

if command -v docker >/dev/null 2>&1; then
  echo "→ Starting Postgres via docker compose"
  docker compose up -d postgres
  echo "→ Waiting for Postgres to be healthy"
  for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U revline -d revline >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  echo "Docker not found. Make sure DATABASE_URL points at a running Postgres."
fi

echo "→ Generating Prisma client"
npx prisma generate

echo "→ Pushing schema"
npx prisma db push --skip-generate

echo "→ Seeding demo data"
npm run db:seed

echo
echo "Done. Run: npm run dev"
echo "Open:    http://localhost:3000"
