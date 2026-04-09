#!/usr/bin/env python3
import sys
import json
import struct
import logging
from pathlib import Path
import asyncio
import traceback

CRASH_LOG = Path.cwd() / "puppeteer_host_crash.log"

def log_line(text: str) -> None:
    try:
        with open(CRASH_LOG, "a", encoding="utf-8") as f:
            f.write(text + "\n")
    except Exception:
        pass

log_line("=== process start ===")
log_line(f"argv: {sys.argv}")

# Configure logging to file
log_dir = Path.home() / ".puppeteer_logs"
try:
    log_dir.mkdir(exist_ok=True)
except Exception as e:
    log_line(f"log_dir mkdir failed: {e}")

log_file = log_dir / "native_host.log"
logging.basicConfig(
    filename=str(log_file),
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)
logger.info("Native messaging host starting up...")


def should_run_setup_local(argv):
    return "--setup" in argv or "--setup-wizard" in argv


def send_message(message):
    try:
        if message is None:
            logger.error("Attempted to send None message")
            return

        message_json = json.dumps(message)
        message_bytes = message_json.encode("utf-8")
        message_length = struct.pack("I", len(message_bytes))

        sys.stdout.buffer.write(message_length)
        sys.stdout.buffer.write(message_bytes)
        sys.stdout.buffer.flush()
    except Exception as e:
        logger.error(f"Error sending message: {e}", exc_info=True)


def read_message():
    try:
        length_bytes = sys.stdin.buffer.read(4)
        if not length_bytes:
            return None
        if len(length_bytes) < 4:
            return None

        message_length = struct.unpack("I", length_bytes)[0]
        if message_length > 1024 * 1024:
            return None

        message_bytes = sys.stdin.buffer.read(message_length)
        if not message_bytes or len(message_bytes) < message_length:
            return None

        return json.loads(message_bytes.decode("utf-8"))
    except Exception as e:
        logger.error(f"Error reading message: {e}", exc_info=True)
        return None


async def handle_api_request(path, options=None):
    import httpx

    if options is None:
        options = {}

    url = f"http://localhost:8000{path}"
    method = options.get("method", "GET").upper()
    headers = options.get("headers", {})
    body = options.get("body")

    try:
        timeout = httpx.Timeout(120.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(
                method,
                url,
                headers=headers,
                content=body.encode() if isinstance(body, str) else body,
            )

        content_type = response.headers.get("content-type", "")
        response_body = response.json() if "application/json" in content_type else response.text

        return {
            "ok": response.status_code < 400,
            "status": response.status_code,
            "body": response_body,
        }
    except Exception as e:
        logger.error(f"API request failed: {e}", exc_info=True)
        return {"ok": False, "status": 0, "body": str(e)}

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

FASTAPI_HOST = "127.0.0.1"
FASTAPI_PORT = 8000

def is_fastapi_running(host: str = FASTAPI_HOST, port: int = FASTAPI_PORT, timeout: float = 0.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False

def get_backend_log_paths() -> tuple[Path, Path]:
    log_dir = Path.home() / ".puppeteer_logs"
    log_dir.mkdir(exist_ok=True)
    return log_dir / "fastapi_stdout.log", log_dir / "fastapi_stderr.log"

def start_fastapi_subprocess() -> subprocess.Popen:
    stdout_log, stderr_log = get_backend_log_paths()

    # Adjust this if your entrypoint is not app:app
    app_import = "app:app"

    # If the exe is installed, this tries to run uvicorn from the same Python environment
    # that built the native host. For a frozen app, you may instead need a bundled backend launcher.
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        app_import,
        "--host",
        FASTAPI_HOST,
        "--port",
        str(FASTAPI_PORT),
        "--log-level",
        "info",
    ]

    stdout_f = open(stdout_log, "a", encoding="utf-8")
    stderr_f = open(stderr_log, "a", encoding="utf-8")

    creationflags = 0
    if os.name == "nt":
        creationflags = subprocess.CREATE_NO_WINDOW

    proc = subprocess.Popen(
        cmd,
        stdout=stdout_f,
        stderr=stderr_f,
        stdin=subprocess.DEVNULL,
        creationflags=creationflags,
        cwd=str(Path(__file__).resolve().parent),
    )
    return proc

def ensure_fastapi_running(start_timeout: float = 8.0) -> bool:
    if is_fastapi_running():
        return True

    proc = start_fastapi_subprocess()

    deadline = time.time() + start_timeout
    while time.time() < deadline:
        if is_fastapi_running():
            return True

        # Process exited early
        if proc.poll() is not None:
            return False

        time.sleep(0.25)

    return False

async def main():
    logger.info("Native messaging host main loop started")
    log_line("entered main()")

    if should_run_setup_local(sys.argv):
        log_line("setup flag detected")
        from setup_wizard import run_setup_wizard
        return run_setup_wizard()
    
    if not ensure_fastapi_running():
        logger.error("FastAPI failed to start or did not become reachable on 127.0.0.1:8000")
        # You can still continue, but requests will fail.
        # Or return a fatal error here if you want.
    try:
        while True:
            message = read_message()
            if message is None:
                logger.info("EOF reached, exiting main loop")
                break

            msg_type = message.get("type")
            if msg_type == "API_FETCH":
                path = message.get("path", "/")
                options = message.get("options", {})
                result = await handle_api_request(path, options)
                send_message(result)
            else:
                send_message({
                    "ok": False,
                    "error": f"Unknown message type: {msg_type}"
                })
    except Exception as e:
        logger.critical(f"Fatal error in main loop: {e}", exc_info=True)
        log_line(f"main loop crash: {e}\n{traceback.format_exc()}")
        raise

    return 0


if __name__ == "__main__":
    try:
        log_line("about to run asyncio.run(main())")
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        logger.info("Native messaging host interrupted")
    except Exception as e:
        log_line(f"fatal at __main__: {e}\n{traceback.format_exc()}")
        try:
            send_message({"ok": False, "error": f"Fatal error: {e}"})
        except Exception:
            pass
        sys.exit(1)