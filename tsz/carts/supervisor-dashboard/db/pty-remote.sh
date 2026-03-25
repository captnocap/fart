#!/usr/bin/env bash
set -euo pipefail

SOCK="/run/user/${UID:-1000}/claude-sessions/supervisor.sock"

usage() {
    cat <<'HELP'
Usage: pty-remote.sh <command> [args...]

Commands:
  list                              List active terminals
  write <slot> <text>               Send text to terminal (use \n for enter)
  read <slot>                       Read full terminal buffer
  row <slot> <row>                  Read single row with token
  state <slot>                      Get terminal semantic state
  resize <slot> <rows> <cols>       Resize terminal
  alive <slot>                      Check if PTY is alive
  run <slot> <command>              Send command + enter to terminal

Examples:
  pty-remote.sh list
  pty-remote.sh write 0 "ls -la\n"
  pty-remote.sh run 0 "claude --dangerously-skip-permissions"
  pty-remote.sh read 0
  pty-remote.sh state 0
HELP
    exit 1
}

send() {
    if [ ! -S "$SOCK" ]; then
        echo "Error: supervisor not running (no socket at $SOCK)" >&2
        exit 1
    fi
    python3 -c "
import socket, sys
s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
s.connect('$SOCK')
s.sendall((sys.argv[1] + '\n').encode())
s.settimeout(2.0)
try:
    data = s.recv(32768)
    sys.stdout.buffer.write(data)
except socket.timeout:
    pass
s.close()
" "$1"
}

[ $# -lt 1 ] && usage

CMD="$1"
shift

case "$CMD" in
    list)
        send '{"op":"list"}'
        ;;
    write)
        [ $# -lt 2 ] && { echo "Usage: pty-remote.sh write <slot> <text>" >&2; exit 1; }
        SLOT="$1"
        TEXT="$2"
        # Interpret \n as actual newlines
        TEXT=$(printf '%s' "$TEXT" | sed 's/\\n/\n/g')
        # JSON-escape the text
        ESCAPED=$(printf '%s' "$TEXT" | jq -Rs '.')
        send "{\"op\":\"write\",\"slot\":${SLOT},\"data\":${ESCAPED}}"
        ;;
    read)
        [ $# -lt 1 ] && { echo "Usage: pty-remote.sh read <slot>" >&2; exit 1; }
        send "{\"op\":\"read\",\"slot\":$1}"
        ;;
    row)
        [ $# -lt 2 ] && { echo "Usage: pty-remote.sh row <slot> <row>" >&2; exit 1; }
        send "{\"op\":\"read_row\",\"slot\":$1,\"row\":$2}"
        ;;
    state)
        [ $# -lt 1 ] && { echo "Usage: pty-remote.sh state <slot>" >&2; exit 1; }
        send "{\"op\":\"state\",\"slot\":$1}"
        ;;
    resize)
        [ $# -lt 3 ] && { echo "Usage: pty-remote.sh resize <slot> <rows> <cols>" >&2; exit 1; }
        send "{\"op\":\"resize\",\"slot\":$1,\"rows\":$2,\"cols\":$3}"
        ;;
    alive)
        [ $# -lt 1 ] && { echo "Usage: pty-remote.sh alive <slot>" >&2; exit 1; }
        send "{\"op\":\"alive\",\"slot\":$1}"
        ;;
    run)
        [ $# -lt 2 ] && { echo "Usage: pty-remote.sh run <slot> <command>" >&2; exit 1; }
        SLOT="$1"
        shift
        COMMAND="$*"
        ESCAPED=$(printf '%s\n' "$COMMAND" | jq -Rs '.')
        send "{\"op\":\"write\",\"slot\":${SLOT},\"data\":${ESCAPED}}"
        ;;
    *)
        echo "Unknown command: $CMD" >&2
        usage
        ;;
esac
