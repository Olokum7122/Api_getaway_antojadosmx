#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${SQL_HOST:?Missing SQL_HOST}"
: "${SQL_USER:?Missing SQL_USER}"
: "${SQL_PASSWORD:?Missing SQL_PASSWORD}"

SQLCMD_BIN="${SQLCMD_BIN:-/opt/mssql-tools18/bin/sqlcmd}"
NODE_BIN="${NODE_BIN:-node}"
NODE_SQL_RUNNER="${NODE_SQL_RUNNER:-$SCRIPT_DIR/exec-sql.js}"
SQL_TRUST_CERT="${SQL_TRUST_CERT:-true}"
LOG_DIR="${LOG_DIR:-/var/log/antojados-scheduler}"
LOCK_DIR="${LOCK_DIR:-/var/lock/antojados-scheduler}"

mkdir -p "$LOG_DIR" "$LOCK_DIR"

LOCK_FILE="$LOCK_DIR/feed-pipeline.lock"
exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Another feed pipeline run is still active. Exiting."
  exit 0
fi

RUN_TS="$(date -u '+%Y%m%dT%H%M%SZ')"
LOG_FILE="$LOG_DIR/feed-pipeline-$RUN_TS.log"

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE"
}

sqlcmd_exec() {
  local database="$1"
  local query="$2"
  local trust_args=()

  if [[ "$SQL_TRUST_CERT" == "true" ]]; then
    trust_args+=("-C")
  fi

  "$SQLCMD_BIN" \
    -S "$SQL_HOST" \
    -U "$SQL_USER" \
    -P "$SQL_PASSWORD" \
    "${trust_args[@]}" \
    -d "$database" \
    -b \
    -Q "$query" >>"$LOG_FILE" 2>&1
}

node_exec() {
  local database="$1"
  local query="$2"

  "$NODE_BIN" "$NODE_SQL_RUNNER" "$database" "$query" >>"$LOG_FILE" 2>&1
}

db_exec() {
  local database="$1"
  local query="$2"

  if [[ -x "$SQLCMD_BIN" ]]; then
    sqlcmd_exec "$database" "$query"
    return
  fi

  node_exec "$database" "$query"
}

run_step() {
  local name="$1"
  local database="$2"
  local query="$3"

  log "START $name on $database"
  db_exec "$database" "$query"
  log "OK $name"
}

main() {
  log "Feed pipeline started"

  run_step \
    "job1_validate_enrich" \
    "ATLX_GT_INTEGRATION" \
    "EXEC gt_antojados.usp_fei_validate_enrich;"

  run_step \
    "job2_dispatch_streams" \
    "ATLX_GT_INTEGRATION" \
    "EXEC gt_antojados.usp_fei_dispatch_streams;"

  run_step \
    "job3_dispatch_tags" \
    "ATLX_GT_INTEGRATION" \
    "EXEC gt_antojados.usp_tags_dispatch_stream;"

  run_step \
    "job5_aggregate_monthly" \
    "ATLX_GT_ANALYTICS" \
    "EXEC gt_antojados.usp_s5_aggregate_monthly;"

  log "Feed pipeline finished"
}

main "$@"
