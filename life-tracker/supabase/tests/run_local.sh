#!/usr/bin/env bash
# Applies every migration to a throwaway local PostgreSQL and runs the RLS tests.
# Usage: supabase/tests/run_local.sh   (needs PostgreSQL 15+ binaries installed)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
DATA="$(mktemp -d)"
PORT=54329
RUN=()
if [ "$(id -u)" = 0 ]; then chown postgres "$DATA"; RUN=(runuser -u postgres --); fi
cleanup() { "${RUN[@]}" "$BIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
"${RUN[@]}" "$BIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"${RUN[@]}" "$BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
PSQL=("${RUN[@]}" "$BIN/psql" -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$HERE/auth_shim.sql"
for f in "$ROOT"/migrations/*.sql; do echo "applying $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f "$HERE/rls_test.sql" 2>&1 | sed 's/^psql:.*NOTICE:  /  /'
