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

sleep 2
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
