#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

HOST=127.0.0.1
PORT=5173
BASE_URL="http://${HOST}:${PORT}"
DEBUG_URL="${BASE_URL}/?campaignDebug=1&debug=1"

fail() {
  printf '\nDEFLECT launcher: %s\n' "$1"
  if [ -t 0 ]; then
    read -r -p "Press Enter to close this window..." _ || true
  fi
  exit 1
}

open_debug_page() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$DEBUG_URL" >/dev/null 2>&1 &
  else
    printf 'Open %s in your browser.\n' "$DEBUG_URL"
  fi
}

command -v npm >/dev/null 2>&1 || fail "npm was not found on PATH."

if [ ! -x node_modules/.bin/vite ]; then
  printf 'DEFLECT: installing dependencies...\n'
  npm install || fail "dependency installation failed."
fi

if command -v curl >/dev/null 2>&1 &&
  curl -fsS --max-time 1 "${BASE_URL}/" 2>/dev/null | grep -q '<title>DEFLECT</title>'; then
  printf 'DEFLECT is already running at %s\n' "$DEBUG_URL"
  open_debug_page
  if [ -t 0 ]; then
    read -r -p "Press Enter to close this window..." _ || true
  fi
  exit 0
fi

printf 'DEFLECT: starting Vite and opening %s\n' "$DEBUG_URL"
printf 'Close this window or press Ctrl+C to stop the server.\n\n'

set +e
npm run dev:campaign
status=$?
set -e

if [ "$status" -ne 0 ] && [ "$status" -ne 130 ]; then
  printf '\nDEFLECT: dev server exited with status %s.\n' "$status"
  if [ -t 0 ]; then
    read -r -p "Press Enter to close this window..." _ || true
  fi
fi

exit "$status"
