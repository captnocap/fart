#!/bin/bash
# Run clippy with the right library path
DIR="$(cd "$(dirname "$0")" && pwd)"
LLM_LIB="$DIR/../../love2d/experiments/llm/lib"
export LD_LIBRARY_PATH="$LLM_LIB:$LD_LIBRARY_PATH"
exec luajit "$DIR/clippy.lua" "$@"
