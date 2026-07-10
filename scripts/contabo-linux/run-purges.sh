#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/run-sql-job.sh" \
  "job6_purge_streams" \
  "ATLX_GT_INTEGRATION" \
  "EXEC gt_antojados.usp_s5_purge_streams;"

"$SCRIPT_DIR/run-sql-job.sh" \
  "job7_purge_ingesta" \
  "ATLX_GT_INTEGRATION" \
  "EXEC gt_antojados.usp_fei_purge_processed;"
