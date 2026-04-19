#!/usr/bin/env python3
import sys
import json
import struct
import logging
from pathlib import Path
import asyncio
import traceback
import os
import httpx

if sys.platform == "win32":
    import winreg
else:
    winreg = None

CRASH_LOG = Path.cwd() / "puppeteer_host_crash.log"

def setup_native_messaging_if_needed():
    """
    Verify and repair native messaging setup on every run (Windows only).
    Always checks that the manifest path and registry entry match the current
    install location — handles fresh installs, reinstalls, and moved installations.
    """
    if sys.platform != "win32" or winreg is None:
        return  # Only relevant on Windows

    try:
        # When frozen by PyInstaller, files sit next to the exe
        if getattr(sys, "frozen", False):
            install_dir = Path(sys.executable).parent
        else:
            install_dir = Path(__file__).parent

        manifest_path = install_dir / "com.puppeteer.native.json"
        host_exe_path = install_dir / "puppeteer-host.exe"
        batch_path = install_dir / "puppeteer_native_host.bat"
        host_command_path = host_exe_path if host_exe_path.exists() else batch_path

        if not manifest_path.exists() or not host_command_path.exists():
            log_line(f"setup_native_messaging: missing files in {install_dir}")
            return

        # Always ensure manifest has the correct path for this install location
        try:
            with open(manifest_path) as f:
                existing = json.load(f)
            manifest_needs_update = existing.get("path") != str(host_command_path)
        except Exception:
            manifest_needs_update = True

        if manifest_needs_update:
            manifest_data = {
                "name": "com.puppeteer.native",
                "description": "Native messaging host for Puppeteer Firefox Extension",
                "path": str(host_command_path),
                "type": "stdio",
                "allowed_extensions": ["puppeteer@example.com"]
            }
            with open(manifest_path, 'w') as f:
                json.dump(manifest_data, f, indent=2)
            log_line(f"Native messaging manifest updated: {manifest_path}")

        # Always ensure registry points to the correct manifest location
        reg_path = r"Software\Mozilla\NativeMessagingHosts\com.puppeteer.native"
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, reg_path)
            existing_val = winreg.QueryValue(key, '')
            winreg.CloseKey(key)
            reg_needs_update = existing_val != str(manifest_path)
        except WindowsError:
            reg_needs_update = True

        if reg_needs_update:
            key = winreg.CreateKey(winreg.HKEY_CURRENT_USER, reg_path)
            winreg.SetValueEx(key, '', 0, winreg.REG_SZ, str(manifest_path))
            winreg.CloseKey(key)
            log_line(f"Native messaging registry updated: {manifest_path}")

    except Exception as e:
        log_line(f"Failed to auto-setup native messaging: {e}")
        # Don't crash, just log and continue

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
    if options is None:
        options = {}

    url = f"http://localhost:8000{path}"
    method = options.get("method", "GET").upper()
    headers = options.get("headers", {})
    body = options.get("body")

    try:
        timeout = httpx.Timeout(120.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
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
        err_detail = f"{type(e).__name__}: {e}"
        logger.error(f"API request failed — {err_detail}", exc_info=True)
        log_line(f"handle_api_request EXCEPTION — {err_detail}\n{traceback.format_exc()}")
        return {"ok": False, "status": 0, "body": err_detail}

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

def get_backend_exe_path() -> Path:
    """
    Find the bundled backend executable for the current platform.
    On Windows this is puppeteer-backend.exe.
    On Linux this is puppeteer-backend.
    When running from source, it's in the dist/ subfolder.
    """
    backend_name = "puppeteer-backend.exe" if os.name == "nt" else "puppeteer-backend"

    # PyInstaller: sys.executable is the .exe itself; siblings live in the same folder
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent / backend_name

    # Running from source — check dist/ relative to this file
    return Path(__file__).parent / "dist" / backend_name

def start_fastapi_subprocess() -> subprocess.Popen:
    stdout_log, stderr_log = get_backend_log_paths()

    backend_exe = get_backend_exe_path()

    if backend_exe.exists():
        # Use the bundled backend executable (release / installed build)
        cmd = [str(backend_exe)]
        cwd = str(backend_exe.parent)
    else:
        # Fallback: running from source with Python available
        cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "app:app",
            "--host",
            FASTAPI_HOST,
            "--port",
            str(FASTAPI_PORT),
            "--log-level",
            "info",
        ]
        cwd = str(Path(__file__).resolve().parent)

    log_line(f"Starting FastAPI with cmd: {cmd}")

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
        cwd=cwd,
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

    # Auto-setup native messaging if needed
    setup_native_messaging_if_needed()
    
    if should_run_setup_local(sys.argv):
        log_line("setup flag detected")
        from setup_wizard import run_setup_wizard
        return run_setup_wizard()
    
    if not ensure_fastapi_running():
        logger.error("FastAPI failed to start or did not become reachable on 127.0.0.1:8000")
        log_line("FastAPI did not start — check ~/.puppeteer_logs/fastapi_stderr.log")
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