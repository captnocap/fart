#!/usr/bin/env bash
set -euo pipefail

MEMORY_DIR="${HOME}/.claude/projects/-home-siah-supervisor-claude/memory"
TYPE_FILTER=""
SEARCH_FILTER=""

while [ $# -gt 0 ]; do
    case "$1" in
        --type)
            shift
            [ $# -lt 1 ] && { echo "Error: --type needs a value" >&2; exit 1; }
            TYPE_FILTER="$1"
            ;;
        --search)
            shift
            [ $# -lt 1 ] && { echo "Error: --search needs a value" >&2; exit 1; }
            SEARCH_FILTER="$1"
            ;;
        *)
            echo "Usage: index-memories.sh [--type feedback|project|reference|user] [--search query]" >&2
            exit 1
            ;;
    esac
    shift
done

if [ ! -d "$MEMORY_DIR" ]; then
    echo "[]"
    exit 0
fi

first=true
echo "["

for file in "$MEMORY_DIR"/*.md; do
    [ ! -f "$file" ] && continue
    basename=$(basename "$file")

    # Skip MEMORY.md index file
    [ "$basename" = "MEMORY.md" ] && continue

    # Parse frontmatter — extract name, description, type
    name=""
    description=""
    type=""
    in_frontmatter=false
    frontmatter_done=false
    body=""

    while IFS= read -r line; do
        if [ "$frontmatter_done" = true ]; then
            if [ -n "$body" ]; then
                body="$body\n$line"
            else
                body="$line"
            fi
            continue
        fi

        if [ "$line" = "---" ]; then
            if [ "$in_frontmatter" = true ]; then
                frontmatter_done=true
            else
                in_frontmatter=true
            fi
            continue
        fi

        if [ "$in_frontmatter" = true ]; then
            case "$line" in
                name:*)     name="${line#name: }" ;;
                description:*) description="${line#description: }" ;;
                type:*)     type="${line#type: }" ;;
            esac
        fi
    done < "$file"

    # Apply type filter
    if [ -n "$TYPE_FILTER" ] && [ "$type" != "$TYPE_FILTER" ]; then
        continue
    fi

    # Apply search filter (case-insensitive grep across name, description, body)
    if [ -n "$SEARCH_FILTER" ]; then
        if ! grep -qi "$SEARCH_FILTER" "$file" 2>/dev/null; then
            continue
        fi
    fi

    # Get file metadata
    modified_date=$(stat -c '%Y' "$file" 2>/dev/null || echo "0")
    modified_iso=$(date -d "@$modified_date" -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo "")
    size_bytes=$(stat -c '%s' "$file" 2>/dev/null || echo "0")

    # JSON-escape strings
    json_escape() {
        printf '%s' "$1" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()), end="")' 2>/dev/null \
            || printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g')"
    }

    name_j=$(json_escape "$name")
    desc_j=$(json_escape "$description")
    type_j=$(json_escape "$type")
    file_j=$(json_escape "$basename")

    # Read body content (everything after second ---)
    body_content=$(sed -n '/^---$/,/^---$/d; /^---$/!p' "$file" | sed '1{/^$/d}')
    body_j=$(json_escape "$body_content")

    if [ "$first" = true ]; then
        first=false
    else
        echo ","
    fi

    cat <<ENTRY
  {
    "filename": ${file_j},
    "name": ${name_j},
    "description": ${desc_j},
    "type": ${type_j},
    "content": ${body_j},
    "modified_date": "${modified_iso}",
    "size_bytes": ${size_bytes}
  }
ENTRY

done

echo ""
echo "]"
