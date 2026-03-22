#!/bin/bash
# report-to-supervisor.sh — Workers call this to notify the supervisor pane.
# Injects a message into the supervisor's Claude Code session via kitty.
#
# Usage (from worker):
#   bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/report-to-supervisor.sh "Task X is done"
#   bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/report-to-supervisor.sh "BLOCKED: need approval for Y"
#   bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/report-to-supervisor.sh "ERROR: build failed on Z"
#
# Can also be called as a PostToolUse hook to auto-report on certain events.

set +e

SUPERVISOR_PANE=1
MSG="$1"

# If called as a hook (stdin has JSON), extract session info and build message
if [ -z "$MSG" ]; then
    INPUT=$(cat)
    SID=$(echo "$INPUT" | jq -r '.session_id // ""' 2>/dev/null)
    SHORT="${SID:0:4}"
    HOOK=$(echo "$INPUT" | jq -r '.hook_event_name // ""' 2>/dev/null)
    TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null)

    # Only auto-report on specific conditions (customize as needed)
    # For now, only report if explicitly called with a message
    exit 0
fi

# Get caller's session short ID
SESSIONS_DIR="/run/user/$(id -u)/claude-sessions/reactjit"
CALLER_SHORT="????"
if [ -n "$CLAUDE_SESSION_ID" ]; then
    CALLER_SHORT="${CLAUDE_SESSION_ID:0:4}"
else
    # Try to figure out from session files which one we are
    for f in "$SESSIONS_DIR"/*.json; do
        [ -f "$f" ] || continue
        S_SHORT=$(jq -r '.short' "$f" 2>/dev/null)
        S_PANE=$(jq -r '.kitty_pane // ""' "$f" 2>/dev/null)
        # Can't easily determine, use first active
    done
fi

TIMESTAMP=$(date +%H:%M:%S)

# Inject into supervisor's pane
kitten @ send-text --match "id:$SUPERVISOR_PANE" -- "WORKER REPORT [$CALLER_SHORT @ $TIMESTAMP]: $MSG\r"

exit 0
