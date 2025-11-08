#!/bin/bash

# Tip Pool Tracker launcher
# This helper starts the dev server and opens the app in your default browser.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${TIP_POOL_APP_PORT:-8000}"

if [ ! -x "./start-server.sh" ]; then
  echo "Making start-server.sh executable..."
  chmod +x ./start-server.sh
fi

LOG_FILE="${SCRIPT_DIR}/.tip-pool-server.log"

echo "================================================"
echo " Tip Pool Tracker – Quick Start"
echo "================================================"
echo "Using directory : $SCRIPT_DIR"
echo "Server port     : $PORT"
echo "Log file        : $LOG_FILE"
echo "================================================"

echo "Starting server..."
./start-server.sh "$PORT" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

cleanup() {
  if ps -p "$SERVER_PID" >/dev/null 2>&1; then
    echo ""
    echo "Stopping server (PID $SERVER_PID)..."
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

probe_url() {
  local url="$1"

  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    return 1
  fi

  if command -v python3 >/dev/null 2>&1; then
    if python3 - "$url" <<'PY'
import sys
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

url = sys.argv[1]
try:
    with urlopen(url, timeout=1):
        pass
except (URLError, HTTPError):
    sys.exit(1)
PY
    then
      return 0
    fi
    return 1
  fi

  return 1
}

wait_for_server() {
  local max_attempts="${1:-40}"
  local delay="${2:-0.5}"
  local attempt=0
  local url="http://127.0.0.1:${PORT}/tip-pool-tracker.html"

  while (( attempt < max_attempts )); do
    if ! ps -p "$SERVER_PID" >/dev/null 2>&1; then
      return 2
    fi

    if probe_url "$url"; then
      return 0
    fi

    attempt=$((attempt + 1))
    sleep "$delay"
  done

  return 1
}

echo "Waiting for server to become ready..."
if wait_for_server 40 0.5; then
  echo "Server is ready."
else
  status=$?
  echo "Failed to confirm that the server is ready."
  if [ "$status" -eq 2 ]; then
    echo "The server process exited unexpectedly. Check the log below:"
  else
    echo "The server did not respond within the expected time. Check the log below:"
  fi

  if [ -f "$LOG_FILE" ]; then
    echo "----- Last 40 log lines -----"
    tail -n 40 "$LOG_FILE" || true
    echo "----- End log -----"
  else
    echo "Log file $LOG_FILE not found."
  fi
  exit 1
fi

APP_URL="http://localhost:${PORT}/tip-pool-tracker.html"

echo "Opening $APP_URL"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$APP_URL" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "$APP_URL" >/dev/null 2>&1 || true
else
  echo "Please open $APP_URL manually (no opener available)."
fi

echo ""
echo "Server logs are streaming at $LOG_FILE"
echo "Press Ctrl+C to stop the server."
echo ""

wait "$SERVER_PID"
