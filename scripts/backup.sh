#!/usr/bin/env sh
set -eu

usage() { printf 'Usage: %s [output.sql]\n' "$0" >&2; }
output=${1:-nodvis-finance-$(date -u +%Y%m%dT%H%M%SZ).sql}

case "$output" in
  /*|[A-Za-z0-9._/-]*) ;;
  *) usage; exit 2 ;;
esac
printf 'Creating PostgreSQL backup at %s\n' "$output"
docker compose -f docker-compose.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' > "$output"
test -s "$output"
printf 'Backup verified: %s bytes\n' "$(wc -c < "$output")"
