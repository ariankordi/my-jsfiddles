#!/bin/bash

# Downloads all revisions of JSFiddle entries from a JSON list.
# JSON is in the format: https://jsfiddle.net/api/user/arian_/demo/list.json\?limit=50
# Resumes from last successful download if interrupted.

#set -euo pipefail

JSFIDDLE_HOST="jsfiddle.net"
OUTPUT_DIR="fiddle-wget"
PROGRESS_FILE="download_progress.json"

if [ $# -lt 2 ]; then
  echo "Usage: $0 <json-list> <username>"
  echo "  <json-list>  Path to JSON file from JSFiddle API"
  echo "  <username>   JSFiddle username (e.g., arian_)"
  exit 1
fi

JSON_FILE="$1"
USERNAME="$2"

get_progress() {
  if [ -f "$PROGRESS_FILE" ]; then
    jq -r '.lastIndex' "$PROGRESS_FILE"
  else
    echo 0
  fi
}

save_progress() {
  echo "{\"lastIndex\": $1}" > "$PROGRESS_FILE"
}

#extract_id() {
#  echo "$1" | sed -E "s|.*/${USERNAME}/([a-z0-9]+)/.*|\1|"
#}

mkdir -p "$OUTPUT_DIR"

last_index=$(get_progress)
total=$(jq 'length' "$JSON_FILE")

jq -r ".[] | @json" "$JSON_FILE" | tail -n +$((last_index + 1)) |
  while IFS= read -r line; do
    fiddle=$(echo "$line" | jq -r '.')
    url=$(echo "$fiddle" | jq -r '.url' | sed 's|^//||')
    latest_version=$(echo "$fiddle" | jq -r '.latest_version')

    #id=$(extract_id "$url")
    fiddle_dir="$OUTPUT_DIR/$url"

    mkdir -p "$fiddle_dir"

    echo "Downloading $url (index $last_index/$total)..."

    for rev in $(seq 0 "$latest_version"); do
      out="$fiddle_dir/$rev.html"
      if [ -f "$out" ]; then
        echo "  Revision $rev/$latest_version (already exists, skipping)"
        continue
      fi

      echo "  Revision $rev/$latest_version"
      url_full="https://$url$rev/"

      if ! curl -v "$url_full" > "$out"; then
        echo "Error downloading $url_full"
        exit 1
      fi
    done

    last_index=$((last_index + 1))
    save_progress "$last_index"
  done

rm -f "$PROGRESS_FILE"
echo "Download complete!"
