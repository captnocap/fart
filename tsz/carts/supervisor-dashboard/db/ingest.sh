#!/usr/bin/env bash
set -euo pipefail

DB_PATH="/run/user/${UID:-1000}/claude-sessions/supervisor.db"

usage() {
    echo "Usage: $0 <jsonl-file> <project-name> [worker-id]"
    echo "  Parses a Claude JSONL session file and inserts into the supervisor DB."
    exit 1
}

[ $# -lt 2 ] && usage

JSONL_FILE="$1"
PROJECT_NAME="$2"
WORKER_ID="${3:-}"

if [ ! -f "$JSONL_FILE" ]; then
    echo "Error: File not found: $JSONL_FILE"
    exit 1
fi

if [ ! -f "$DB_PATH" ]; then
    echo "Error: DB not found at $DB_PATH — run init.sh first"
    exit 1
fi

# Resolve project ID
PROJECT_ID=$(sqlite3 "$DB_PATH" "SELECT id FROM projects WHERE name = '${PROJECT_NAME}';")
if [ -z "$PROJECT_ID" ]; then
    echo "Error: Project '${PROJECT_NAME}' not found"
    exit 1
fi

# Create session record
WORKER_CLAUSE="NULL"
if [ -n "$WORKER_ID" ]; then
    WORKER_CLAUSE="$WORKER_ID"
fi

sqlite3 "$DB_PATH" "INSERT INTO sessions (project_id, worker_id, jsonl_path) VALUES (${PROJECT_ID}, ${WORKER_CLAUSE}, '$(echo "$JSONL_FILE" | sed "s/'/''/g")');"
SESSION_ID=$(sqlite3 "$DB_PATH" "SELECT last_insert_rowid();")

echo "Created session ${SESSION_ID} for project '${PROJECT_NAME}' from ${JSONL_FILE}"

# Parse JSONL and insert messages
# Each line is a JSON object — extract role, content, timestamp
COUNT=0
while IFS= read -r line; do
    [ -z "$line" ] && continue

    # Extract fields with jq
    ROLE=$(echo "$line" | jq -r '.role // "unknown"' 2>/dev/null) || continue
    CONTENT=$(echo "$line" | jq -r '.message // .content // ""' 2>/dev/null) || continue
    TIMESTAMP=$(echo "$line" | jq -r '.timestamp // ""' 2>/dev/null) || TIMESTAMP=""

    [ -z "$CONTENT" ] && continue

    if [ -z "$TIMESTAMP" ]; then
        TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    fi

    # Escape single quotes for SQL
    CONTENT_ESC=$(printf '%s' "$CONTENT" | sed "s/'/''/g")
    ROLE_ESC=$(printf '%s' "$ROLE" | sed "s/'/''/g")

    sqlite3 "$DB_PATH" "INSERT INTO messages (session_id, role, content, timestamp) VALUES (${SESSION_ID}, '${ROLE_ESC}', '${CONTENT_ESC}', '${TIMESTAMP}');"
    COUNT=$((COUNT + 1))
done < "$JSONL_FILE"

# Update session started_at from first message
sqlite3 "$DB_PATH" "UPDATE sessions SET started_at = COALESCE((SELECT MIN(timestamp) FROM messages WHERE session_id = ${SESSION_ID}), started_at) WHERE id = ${SESSION_ID};"

echo "Ingested ${COUNT} messages into session ${SESSION_ID}"
