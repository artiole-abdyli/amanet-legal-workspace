# Production image for the Harlow & Vance workspace.
#
# One container runs the app. Postgres is a separate managed service, and
# uploaded and signed PDFs live on a mounted volume at /data, so a redeploy
# never loses a file.

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies first, so a code change does not reinstall them. The schema is
# needed here because `postinstall` generates the Prisma client from it.
COPY package.json package-lock.json prisma7.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY . .

# The build never touches the database (every query runs at request time), but
# lib/prisma.ts refuses to load without a connection string, so it gets a
# placeholder that is never dialled.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

ENV NODE_ENV=production \
    STORAGE_DIR=/data/storage \
    PORT=3000

EXPOSE 3000

CMD ["sh", "scripts/start.sh"]
