#!/bin/bash
# One-shot deploy script. Run this after cloning on the VPS and setting up .env.
# Usage: bash deploy.sh
set -e

echo "== Checking .env =="
if [ ! -f .env ]; then
  echo "No .env found. Creating one from .env.prod.example -- edit it now, then re-run this script."
  cp .env.prod.example .env
  echo ""
  echo "Opening .env in nano. Set a real DB_PASSWORD and your DOMAIN, then Ctrl+O, Enter, Ctrl+X to save."
  read -p "Press Enter to open .env in nano..." _
  nano .env
  echo "Re-run: bash deploy.sh"
  exit 0
fi

echo "== Building images (no cache, to avoid any stale-layer issues) =="
docker compose -f docker-compose.prod.yml build --no-cache

echo "== Starting database =="
docker compose -f docker-compose.prod.yml up -d db

echo "== Waiting for database to accept connections =="
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T db pg_isready -U gingin > /dev/null 2>&1; then
    echo "Database is ready."
    break
  fi
  sleep 2
done

echo "== Running migrations =="
docker compose -f docker-compose.prod.yml run --rm migrate npx prisma migrate deploy

echo "== Importing monthly sales data =="
docker compose -f docker-compose.prod.yml run --rm migrate npm run import:monthly

echo "== Starting the app =="
docker compose -f docker-compose.prod.yml up -d app

echo ""
echo "== Done. =="
echo "Check status with: docker compose -f docker-compose.prod.yml ps"
echo "Check app logs with: docker compose -f docker-compose.prod.yml logs -f app"
