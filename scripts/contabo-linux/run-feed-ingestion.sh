#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/run-sql-job.sh" \
  "job1_validate_enrich" \
  "ATLX_GT_INTEGRATION" \
  "EXEC gt_antojados.usp_fei_validate_enrich;"

"$SCRIPT_DIR/run-sql-job.sh" \
  "job2_dispatch_streams" \
  "ATLX_GT_INTEGRATION" \
  "EXEC gt_antojados.usp_fei_dispatch_streams;"
