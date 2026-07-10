#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/run-sql-job.sh" \
  "job5_aggregate_monthly" \
  "ATLX_GT_ANALYTICS" \
  "EXEC gt_antojados.usp_s5_aggregate_monthly;"
