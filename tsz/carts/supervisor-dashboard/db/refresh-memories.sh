#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="/run/user/${UID:-1000}/claude-sessions"
OUT_PATH="${OUT_DIR}/memory_view.json"

mkdir -p "$OUT_DIR"

# Run both scripts and combine into a single JSON
MEMORIES=$("$SCRIPT_DIR/index-memories.sh" "$@")
STATS=$("$SCRIPT_DIR/memory-stats.sh")

# Combine into { memories: [...], stats: {...} }
printf '{\n  "memories": %s,\n  "stats": %s\n}\n' "$MEMORIES" "$STATS" > "$OUT_PATH"

echo "Wrote memory view to ${OUT_PATH}" >&2
