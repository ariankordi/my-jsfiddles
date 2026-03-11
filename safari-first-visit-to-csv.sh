#!/bin/bash

# Extracts the first visit timestamp for each JSFiddle URL from Safari history.
# Outputs CSV: date,url for use in cross-referencing revision dates.

set -euo pipefail

JSFIDDLE_HOST="jsfiddle.net"

if [ $# -lt 2 ]; then
  echo "Usage: $0 <safari-history-db> <search-contains> [output-file]"
  echo "  <safari-history-db>  Path to Safari History.db"
  echo "                       (e.g., ~/Library/Safari/History.db)"
  echo "  <search-contains>    URL pattern to search (e.g., 'jsfiddle.net/arian_')"
  echo "  [output-file]        Output CSV file (default: history.csv)"
  echo ""
  echo "Output format: date,url"
  exit 1
fi

DB_PATH="$1"
SEARCH_PATTERN="$2"
OUTPUT_FILE="${3:-history.csv}"

sqlite3 "$DB_PATH" -csv \
  "WITH clean AS (
     SELECT
       CASE
         WHEN instr(i.url, '?') > 0 THEN substr(i.url, 1, instr(i.url, '?') - 1)
         WHEN instr(i.url, '#') > 0 THEN substr(i.url, 1, instr(i.url, '#') - 1)
         ELSE i.url
       END AS url,
       v.visit_time
     FROM history_items i
     JOIN history_visits v ON i.id = v.history_item
     WHERE i.url LIKE '%$SEARCH_PATTERN%'
   )
   SELECT
     strftime('%Y-%m-%dT%H:%M:%SZ', MIN(visit_time) + 978307200, 'unixepoch') AS date,
     url
   FROM clean
   GROUP BY url
   ORDER BY MIN(visit_time) ASC;" \
  > "$OUTPUT_FILE"

echo "Extracted to $OUTPUT_FILE"
