#!/usr/bin/env bash
set -euo pipefail

DB_PATH="/run/user/${UID:-1000}/claude-sessions/supervisor.db"

usage() {
    echo "Usage: $0 <project-name> <event-type> [payload-json] [worker-id]"
    echo "  Logs a hook event into the supervisor DB."
    echo ""
    echo "  event-type examples: tool_use, tool_result, session_start, session_end,"
    echo "                       commit, build_start, build_fail, build_ok"
    echo "  payload-json: optional JSON string (default: {})"
    echo "  worker-id: optional numeric worker ID"
    exit 1
}

[ $# -lt 2 ] && usage

PROJECT_NAME="$1"
EVENT_TYPE="$2"
PAYLOAD="${3:-{\}}"
WORKER_ID="${4:-}"

if [ ! -f "$DB_PATH" ]; then
    echo "Error: DB not found at $DB_PATH — run init.sh first" >&2
    exit 1
fi

PROJECT_ID=$(sqlite3 "$DB_PATH" "SELECT id FROM projects WHERE name = '$(echo "$PROJECT_NAME" | sed "s/'/''/g")';")
if [ -z "$PROJECT_ID" ]; then
    echo "Error: Project '${PROJECT_NAME}' not found" >&2
    exit 1
fi

WORKER_CLAUSE="NULL"
if [ -n "$WORKER_ID" ]; then
    WORKER_CLAUSE="$WORKER_ID"
fi

EVENT_ESC=$(printf '%s' "$EVENT_TYPE" | sed "s/'/''/g")
PAYLOAD_ESC=$(printf '%s' "$PAYLOAD" | sed "s/'/''/g")

sqlite3 "$DB_PATH" "INSERT INTO events (project_id, worker_id, event_type, payload_json) VALUES (${PROJECT_ID}, ${WORKER_CLAUSE}, '${EVENT_ESC}', '${PAYLOAD_ESC}');"

echo "Logged event: ${EVENT_TYPE} for project ${PROJECT_NAME}"
