"""
Entry point for the bundled Puppeteer FastAPI backend.
This file is used by PyInstaller to create puppeteer-backend.exe.
It starts uvicorn programmatically so it can run without Python installed.
"""
import sys
import multiprocessing
from pathlib import Path

# Required for PyInstaller multiprocessing support on Windows
multiprocessing.freeze_support()

# Ensure the backend directory is on the path
sys.path.insert(0, str(Path(__file__).parent))

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8000,
        log_level="info",
    )
