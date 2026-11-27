#!/usr/bin/env bash
# Builds a throw-away local Postgres database, applies every migration, and runs the access tests.
# Needs a local PostgreSQL server (version 15 or newer) that this user can create databases on.
#   supabase/tests/run.sh
# Set PSQL to change how psql connects, for example: PSQL="psql -h localhost -U postgres" supabase/tests/run.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL="${PSQL:-psql}"
DB="cuagain_test"

$PSQL -q -d postgres -c "drop database if exists $DB" -c "create database $DB"

for f in "$DIR/tests/harness.sql" "$DIR"/migrations/*.sql; do
  echo "applying $(basename "$f")"
  $PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done

echo "running access tests"
$PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f "$DIR/tests/rls_tests.sql"

$PSQL -q -d postgres -c "drop database $DB"
echo "all access tests passed"
