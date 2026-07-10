#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_FILE="$SCRIPT_DIR/cron/antojados-scheduler.cron"

if [[ ! -f "$CRON_FILE" ]]; then
  echo "Cron template not found: $CRON_FILE" >&2
  exit 1
fi

TMP_CRON="$(mktemp)"
crontab -l 2>/dev/null >"$TMP_CRON" || true

grep -v "antojados/scripts/contabo-linux/" "$TMP_CRON" > "${TMP_CRON}.clean" || true
mv "${TMP_CRON}.clean" "$TMP_CRON"

cat "$CRON_FILE" >>"$TMP_CRON"
crontab "$TMP_CRON"
rm -f "$TMP_CRON"

echo "Cron installed from $CRON_FILE"
