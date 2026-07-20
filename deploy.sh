#!/bin/bash
# One-click deploy. Pulls latest code, builds fresh images, applies
# migrations, imports data, and starts the app -- with explicit error
# handling at every stage so a failure stops the script with a clear
# message instead of silently limping forward.
#
# Usage: bash deploy.sh
#
# Uses `prisma migrate deploy`, not `migrate dev` -- deploy only applies
# migration files that are already committed to the repo. It never
# generates new ones, so this never needs the VPS to push back to git.
# New migrations only ever get created locally (or via one intentional
# `migrate dev` run) and pushed from a machine that has push access.

set -uo pipefail
COMPOSE="docker compose -f docker-compose.prod.yml"
FAILED=0

step() {
  echo ""
  echo "== $1 =="
}

run() {
  # Runs a command, reports pass/fail clearly, and stops the whole script
  # on the first real failure rather than continuing into a broken state.
  if ! "$@"; then
    echo ""
    echo "!! FAILED: $*"
    echo "!! Stopping here -- fix the error above and re-run: bash deploy.sh"
    exit 1
  fi
}

step "Pulling latest code"
run git pull

step "Checking .env"
if [ ! -f .env ]; then
  echo "No .env found. Creating one from .env.prod.example."
  cp .env.prod.example .env
  echo ""
  echo "Opening .env in nano -- set a real DB_PASSWORD and your DOMAIN."
  read -p "Press Enter to open nano..." _
  nano .env
  echo "Re-run: bash deploy.sh"
  exit 0
fi

step "Building images (no cache)"
run $COMPOSE build --no-cache

step "Starting database"
run $COMPOSE up -d db

step "Waiting for database to accept connections"
DB_READY=0
for i in $(seq 1 30); do
  if $COMPOSE exec -T db pg_isready -U gingin > /dev/null 2>&1; then
    echo "Database is ready."
    DB_READY=1
    break
  fi
  sleep 2
done
if [ "$DB_READY" -ne 1 ]; then
  echo "!! Database never became ready after 60 seconds. Check: $COMPOSE logs db"
  exit 1
fi

step "Applying migrations"
if ! $COMPOSE run --rm migrate npx prisma migrate deploy; then
  echo ""
  echo "!! Migration failed."
  echo "!! If this is a genuinely new environment with no migration files yet,"
  echo "!! that's a different, one-time situation -- ask for help rather than"
  echo "!! re-running this script blindly, since migrate deploy can't create"
  echo "!! the first migration on its own."
  exit 1
fi

step "Importing monthly sales data"
run $COMPOSE run --rm migrate npm run import:monthly

step "Rebuilding and starting the app"
# Force-remove any stale image by ID first -- `docker compose run` and
# `up` can otherwise silently reuse an old image instead of the one just
# built, which caused real problems earlier in this project.
OLD_IMAGE=$(docker images | grep gingin-forcasting-app | awk '{print $3}')
if [ -n "$OLD_IMAGE" ]; then
  docker rmi -f $OLD_IMAGE > /dev/null 2>&1
fi
run $COMPOSE build --no-cache app
run $COMPOSE up -d app

step "Checking the app actually started"
sleep 3
if ! $COMPOSE ps app | grep -q "Up"; then
  echo "!! App container isn't running. Check: $COMPOSE logs app"
  exit 1
fi

step "Done"
echo "App is up. Check it's actually serving pages with:"
echo "  $COMPOSE logs app"
echo "  curl -I https://\$(grep DOMAIN .env | cut -d= -f2)"
