#!/bin/bash
# Auto-safety commit — runs on a timer, commits anything dirty.
# Every file not in .gitignore gets committed. No exceptions.
# This exists because Claude sessions routinely fail to commit their work.
#
# Install: crontab -e → */3 * * * * /home/siah/creative/reactjit/scripts/auto-safety-commit.sh
# Or run via: watch -n 180 ./scripts/auto-safety-commit.sh

set -euo pipefail
cd "$(dirname "$0")/.."

# Skip if no git repo
[ -d .git ] || exit 0

# Skip if nothing to commit
if git diff --quiet HEAD 2>/dev/null && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    exit 0
fi

# Stage everything not in .gitignore
git add -A

# Skip if staging produced nothing (e.g. only ignored files)
if git diff --cached --quiet 2>/dev/null; then
    exit 0
fi

# Count what we're saving
CHANGED=$(git diff --cached --stat | tail -1)

# Commit with timestamp
git commit -m "wip: auto-safety $(date '+%Y-%m-%d %H:%M')

$CHANGED

Auto-committed by scripts/auto-safety-commit.sh
Co-Authored-By: safety-net <noreply@local>" --no-gpg-sign 2>/dev/null || true
