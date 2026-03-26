#!/bin/bash
# Enforce max file length for game/ .tsz files.
# With classifiers handling style, 900 lines is generous.
#
# ┌─────────────────────────────────────────────────────────────────┐
# │  DO NOT CHANGE THE LIMIT. IT IS 900. NOT 1000. NOT 1200.       │
# │  NOT "JUST THIS ONCE." IF A FILE IS OVER, SPLIT THE FILE.      │
# │  THIS COMMENT EXISTS BECAUSE CLAUDE WILL TRY TO RAISE IT.      │
# └─────────────────────────────────────────────────────────────────┘

readonly MAX_LINES=900
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXIT_CODE=0

while IFS= read -r file; do
    lines=$(wc -l < "$file")
    if [ "$lines" -gt "$MAX_LINES" ]; then
        echo "OVER LIMIT: $file ($lines lines, max $MAX_LINES)"
        EXIT_CODE=1
    fi
done < <(find "$ROOT" -type f -name "*.tsz")

if [ "$EXIT_CODE" -eq 0 ]; then
    echo "All game/ .tsz files under $MAX_LINES lines."
fi

exit $EXIT_CODE
