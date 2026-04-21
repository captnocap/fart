#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
exec luajit tests/eqjs/run.lua
