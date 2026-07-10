#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/run-sql-job.sh" \
  "job3_dispatch_tags" \
  "ATLX_GT_INTEGRATION" \
  "EXEC gt_antojados.usp_tags_dispatch_stream;"

"$SCRIPT_DIR/run-sql-job.sh" \
  "job4_aggregate_daily" \
  "ATLX_GT_ANALYTICS" \
  "EXEC gt_antojados.usp_s5_aggregate_daily;"
