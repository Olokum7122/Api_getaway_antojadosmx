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

JOB_NAME="${1:?Missing job name}"
DATABASE="${2:?Missing database}"
QUERY="${3:?Missing query}"

LOCK_FILE="$LOCK_DIR/${JOB_NAME}.lock"
exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] ${JOB_NAME}: already running, skipping."
  exit 0
fi

RUN_TS="$(date -u '+%Y%m%dT%H%M%SZ')"
LOG_FILE="$LOG_DIR/${JOB_NAME}-${RUN_TS}.log"

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE"
}

sqlcmd_exec() {
  local trust_args=()

  if [[ "$SQL_TRUST_CERT" == "true" ]]; then
    trust_args+=("-C")
  fi

  "$SQLCMD_BIN" \
    -S "$SQL_HOST" \
    -U "$SQL_USER" \
    -P "$SQL_PASSWORD" \
    "${trust_args[@]}" \
    -d "$DATABASE" \
    -b \
    -Q "$QUERY" >>"$LOG_FILE" 2>&1
}

node_exec() {
  "$NODE_BIN" "$NODE_SQL_RUNNER" "$DATABASE" "$QUERY" >>"$LOG_FILE" 2>&1
}

log "START ${JOB_NAME} on ${DATABASE}"

if [[ -x "$SQLCMD_BIN" ]]; then
  sqlcmd_exec
else
  node_exec
fi

log "OK ${JOB_NAME}"
