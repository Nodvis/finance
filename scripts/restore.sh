#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ] || [ ! -s "$1" ]; then
  printf 'Usage: %s backup.sql\n' "$0" >&2
  exit 2
fi
backup=$1

if [ "${CONFIRM_RESTORE:-}" != "yes" ]; then
  printf 'Restore replaces data in the configured PostgreSQL database.\n' >&2
  printf 'Re-run with CONFIRM_RESTORE=yes to continue.\n' >&2
  exit 3
fi
printf 'Restoring %s\n' "$backup"
docker compose -f docker-compose.yml stop finance >/dev/null
docker compose -f docker-compose.yml exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" --set ON_ERROR_STOP=1 --quiet' < "$backup"
printf 'Restore completed.\n'
