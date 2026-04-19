#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
HOST_BIN="$SCRIPT_DIR/puppeteer-host"
MODELFILE_PATH="$SCRIPT_DIR/Modelfile"
OLLAMA_MODEL_NAME="${OLLAMA_MODEL:-persona}"

ensure_ollama_model() {
  if ! command -v ollama >/dev/null 2>&1; then
    echo "Warning: ollama not found in PATH; skipping automatic model setup." >&2
    return 0
  fi

  if ollama list 2>/dev/null | awk 'NR > 1 {print $1}' | grep -Eq "^${OLLAMA_MODEL_NAME}(:|$)"; then
    return 0
  fi

  if [ ! -f "$MODELFILE_PATH" ]; then
    echo "Warning: Modelfile missing at $MODELFILE_PATH; cannot auto-create model $OLLAMA_MODEL_NAME." >&2
    return 0
  fi

  echo "Ollama model '$OLLAMA_MODEL_NAME' not found. Creating from Modelfile..." >&2
  if ! ollama create "$OLLAMA_MODEL_NAME" -f "$MODELFILE_PATH"; then
    echo "Warning: ollama model creation failed for '$OLLAMA_MODEL_NAME'." >&2
  fi
}

ensure_ollama_model

if [ -x "$HOST_BIN" ]; then
  exec "$HOST_BIN"
fi

# Fallback for source/dev environments where the Python script exists.
if [ -f "$SCRIPT_DIR/native_messaging_host.py" ]; then
  exec python3 "$SCRIPT_DIR/native_messaging_host.py"
fi

echo "Native host launcher not found next to script." >&2
exit 1
