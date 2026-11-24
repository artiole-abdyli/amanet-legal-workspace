#!/bin/sh
# Container entrypoint: bring the schema up to date, make sure the demo data
# exists, then serve.
set -e

echo "Applying database migrations…"
npx prisma migrate deploy --config prisma7.config.ts

if [ "$DEMO_RESET" = "1" ]; then
  # Wipes and re-seeds on every start. Useful for a public demo that reviewers
  # can change freely; leave unset to keep data between deploys.
  echo "DEMO_RESET=1: re-seeding the demo data…"
  npx tsx prisma/seed.ts
else
  npx tsx prisma/seed-if-empty.ts
fi

mkdir -p "${STORAGE_DIR:-/data/storage}"

echo "Starting on port ${PORT:-3000}…"
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
