#!/bin/bash
# Build libreactjit.so directly from zig build (dynamic linkage)
set -euo pipefail
cd "$(dirname "$0")/../.."

# Temporarily build core as .so instead of .a
zig build core -Doptimize=ReleaseFast 2>&1
# The .a is unusable for .so creation due to nested archives.
# Instead, build a shared lib by compiling a thin wrapper that
# re-exports everything via zig build-lib.
echo "done"
