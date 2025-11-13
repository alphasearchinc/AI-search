#!/usr/bin/env bash
set -euo pipefail
curl -fsS "http://localhost:9200/_cluster/health?wait_for_status=yellow&timeout=1s" | grep -q '"status"'