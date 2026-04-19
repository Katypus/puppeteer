#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
HOST_BIN="$SCRIPT_DIR/puppeteer-host"

if [ -x "$HOST_BIN" ]; then
  exec "$HOST_BIN"
fi

# Fallback for source/dev environments where the Python script exists.
if [ -f "$SCRIPT_DIR/native_messaging_host.py" ]; then
  exec python3 "$SCRIPT_DIR/native_messaging_host.py"
fi

echo "Native host launcher not found next to script." >&2
exit 1
