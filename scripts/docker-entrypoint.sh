#!/usr/bin/env sh
set -eu

log() {
  printf '%s\n' "[nodvis-finance] $*"
}

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:?DB_PORT is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${BETTER_AUTH_SECRET:?BETTER_AUTH_SECRET is required}"

log "Validating runtime configuration."
node /app/scripts/validate-runtime-config.mjs

export DATABASE_URL="$(node /app/scripts/database-url.mjs)"
log "Waiting for PostgreSQL and applying migrations."
node /app/scripts/migrate.mjs
log "Starting Nodvis Finance on ${HOSTNAME}:${PORT}."
exec node /app/apps/web/server.js
