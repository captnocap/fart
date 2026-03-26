#!/usr/bin/env bash
# Build all game segments as .so cartridges.
# The project folder app loads these via <Cartridge src="name.so" />.
#
# Usage:
#   game/scripts/build-all.sh          # build all
#   game/scripts/build-all.sh boot     # build one segment
#
# Each segment compiles: .tsz → generated_app.zig → .so
# The dev shell auto-reloads when a .so changes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GAME_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$GAME_DIR/.." && pwd)"
TSZ="$REPO_DIR/bin/tsz"

if [ ! -x "$TSZ" ]; then
  echo "ERROR: $TSZ not found. Build it first:"
  echo "  cd tsz && zig build tsz"
  exit 1
fi

# Segment registry: id → source path (relative to game/)
declare -A SEGMENTS=(
  [boot]="boot/boot.app.tsz"
  [shell]="shell/shell.app.tsz"
  [browser]="apps/browser/browser.app.tsz"
  [messenger]="apps/messenger/messenger.app.tsz"
  [social]="apps/social/social.app.tsz"
  [settings]="apps/settings/settings.app.tsz"
  [creative]="apps/creative/creative.app.tsz"
  [games]="apps/games/games.app.tsz"
  [escape]="escape/escape.app.tsz"
  [folder]="folder/folder.app.tsz"
)

# Ordered for display
ORDERED=(boot shell browser messenger social settings creative games escape folder)

build_segment() {
  local id="$1"
  local src="${SEGMENTS[$id]}"
  local full_path="$GAME_DIR/$src"

  printf "  %-16s" "$id"

  if [ ! -f "$full_path" ]; then
    echo "SKIP (no source)"
    return 0
  fi

  if "$TSZ" dev "$full_path" 2>/dev/null; then
    echo "OK"
  else
    echo "FAIL"
    return 1
  fi
}

echo "=== Dead Internet — Build Segments ==="
echo "    game/ → .so cartridges"
echo ""

FILTER="${1:-}"
BUILT=0
FAILED=0
SKIPPED=0

for id in "${ORDERED[@]}"; do
  if [ -n "$FILTER" ] && [ "$id" != "$FILTER" ]; then
    continue
  fi

  if build_segment "$id"; then
    if [ -f "$GAME_DIR/$src" ] 2>/dev/null; then
      BUILT=$((BUILT + 1))
    else
      SKIPPED=$((SKIPPED + 1))
    fi
  else
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "Done. Built: $BUILT, Skipped: $SKIPPED, Failed: $FAILED"
echo ""
echo "Launch folder: bin/tsz dev game/folder/folder.app.tsz"
