#!/usr/bin/env sh
set -eu

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:?DB_PORT is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${BETTER_AUTH_SECRET:?BETTER_AUTH_SECRET is required}"

export DATABASE_URL="$(node /app/scripts/database-url.mjs)"
node /app/scripts/migrate.mjs
exec node /app/apps/web/server.js
