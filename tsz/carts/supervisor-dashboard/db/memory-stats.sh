#!/usr/bin/env bash
set -euo pipefail

MEMORY_DIR="${HOME}/.claude/projects/-home-siah-supervisor-claude/memory"

if [ ! -d "$MEMORY_DIR" ]; then
    echo '{"total":0,"by_type":{},"most_recent":"","oldest":"","total_size_bytes":0}'
    exit 0
fi

feedback=0
project=0
reference=0
user=0
total=0
total_size=0
newest_ts=0
oldest_ts=999999999999
newest_file=""
oldest_file=""

for file in "$MEMORY_DIR"/*.md; do
    [ ! -f "$file" ] && continue
    basename=$(basename "$file")
    [ "$basename" = "MEMORY.md" ] && continue

    total=$((total + 1))

    # Get size
    sz=$(stat -c '%s' "$file" 2>/dev/null || echo "0")
    total_size=$((total_size + sz))

    # Get modified time
    mtime=$(stat -c '%Y' "$file" 2>/dev/null || echo "0")
    if [ "$mtime" -gt "$newest_ts" ]; then
        newest_ts="$mtime"
        newest_file="$basename"
    fi
    if [ "$mtime" -lt "$oldest_ts" ]; then
        oldest_ts="$mtime"
        oldest_file="$basename"
    fi

    # Parse type from frontmatter
    type=$(sed -n '/^---$/,/^---$/{ /^type:/{ s/^type: *//; p; q; } }' "$file")

    case "$type" in
        feedback)  feedback=$((feedback + 1)) ;;
        project)   project=$((project + 1)) ;;
        reference) reference=$((reference + 1)) ;;
        user)      user=$((user + 1)) ;;
    esac
done

newest_iso=""
oldest_iso=""
if [ "$newest_ts" -gt 0 ]; then
    newest_iso=$(date -d "@$newest_ts" -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo "")
fi
if [ "$oldest_ts" -lt 999999999999 ]; then
    oldest_iso=$(date -d "@$oldest_ts" -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo "")
fi

cat <<JSON
{
  "total": ${total},
  "by_type": {
    "feedback": ${feedback},
    "project": ${project},
    "reference": ${reference},
    "user": ${user}
  },
  "most_recent": "${newest_file}",
  "most_recent_date": "${newest_iso}",
  "oldest": "${oldest_file}",
  "oldest_date": "${oldest_iso}",
  "total_size_bytes": ${total_size}
}
JSON
