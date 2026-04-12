import os
import sys
from pathlib import Path
from dotenv import load_dotenv


def _load_dotenv_from_possible_paths():
    candidates = []

    # If packaged by PyInstaller, .env can be bundled into the temporary _MEIPASS location.
    if getattr(sys, "_MEIPASS", None):
        candidates.append(Path(sys._MEIPASS) / ".env")

    # Running from source or when the executable is launched from the repo root.
    candidates.append(Path.cwd() / ".env")

    # Running from source with backend module path preserved.
    candidates.append(Path(__file__).resolve().parents[1] / ".env")

    # When the exe is placed next to .env, use the executable folder.
    candidates.append(Path(sys.executable).resolve().parent / ".env")

    for candidate in candidates:
        if candidate.exists():
            load_dotenv(candidate)
            return candidate
    return None


env_file = _load_dotenv_from_possible_paths()

if env_file is None:
    # Still attempt a generic load for backwards compatibility.
    load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Check your .env file or environment variables.")
