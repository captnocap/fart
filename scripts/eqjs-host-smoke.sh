#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

zig build app -Dapp-name=eqjs-host-smoke -Dapp-source=eqjs_app.zig -Doptimize=ReleaseFast
./zig-out/bin/eqjs-host-smoke
