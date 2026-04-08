import os
import shutil
import subprocess
import sys
import webbrowser
from pathlib import Path
from typing import Optional, Tuple

import tkinter as tk
from tkinter import messagebox


OLLAMA_DOWNLOAD_URL = "https://ollama.com/download/windows"


def _candidate_ollama_paths() -> list[Path]:
    candidates = []

    local_appdata = os.environ.get("LOCALAPPDATA")
    program_files = os.environ.get("ProgramFiles")
    program_files_x86 = os.environ.get("ProgramFiles(x86)")

    if local_appdata:
        candidates.append(Path(local_appdata) / "Programs" / "Ollama" / "ollama.exe")
    if program_files:
        candidates.append(Path(program_files) / "Ollama" / "ollama.exe")
    if program_files_x86:
        candidates.append(Path(program_files_x86) / "Ollama" / "ollama.exe")

    return candidates


def find_ollama_executable() -> Optional[str]:
    """
    Returns the full path to ollama.exe if found, otherwise None.
    """
    # First try PATH
    path_hit = shutil.which("ollama")
    if path_hit:
        return path_hit

    # Then try likely Windows install locations
    for candidate in _candidate_ollama_paths():
        if candidate.exists():
            return str(candidate)

    return None


def get_ollama_version(ollama_path: str) -> Tuple[bool, str]:
    """
    Returns (ok, output). ok=True when ollama responded successfully.
    """
    try:
        result = subprocess.run(
            [ollama_path, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except Exception as exc:
        return False, f"Failed to run Ollama: {exc}"

    output = (result.stdout or result.stderr or "").strip()
    if result.returncode == 0:
        return True, output or "Ollama is installed."
    return False, output or f"Ollama exited with code {result.returncode}."


class SetupWizard:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("Puppeteer Setup")
        self.root.geometry("560x260")
        self.root.resizable(False, False)

        self.status_var = tk.StringVar()
        self.detail_var = tk.StringVar()

        self._build_ui()
        self.refresh_status()

    def _build_ui(self) -> None:
        outer = tk.Frame(self.root, padx=16, pady=16)
        outer.pack(fill="both", expand=True)

        title = tk.Label(
            outer,
            text="First-time setup",
            font=("Segoe UI", 16, "bold"),
            anchor="w",
        )
        title.pack(fill="x", pady=(0, 10))

        body = tk.Label(
            outer,
            text=(
                "This setup checks whether Ollama is installed on your computer.\n"
                "If it is missing, you can open the installer page, install it, and then re-check."
            ),
            justify="left",
            anchor="w",
        )
        body.pack(fill="x", pady=(0, 16))

        status_frame = tk.LabelFrame(outer, text="Ollama status", padx=12, pady=12)
        status_frame.pack(fill="x", pady=(0, 16))

        status_label = tk.Label(
            status_frame,
            textvariable=self.status_var,
            font=("Segoe UI", 11, "bold"),
            anchor="w",
            justify="left",
        )
        status_label.pack(fill="x", pady=(0, 8))

        detail_label = tk.Label(
            status_frame,
            textvariable=self.detail_var,
            anchor="w",
            justify="left",
            wraplength=500,
        )
        detail_label.pack(fill="x")

        button_row = tk.Frame(outer)
        button_row.pack(fill="x", pady=(8, 0))

        self.install_button = tk.Button(
            button_row,
            text="Install Ollama",
            width=16,
            command=self.open_ollama_download,
        )
        self.install_button.pack(side="left")

        self.refresh_button = tk.Button(
            button_row,
            text="Check Again",
            width=16,
            command=self.refresh_status,
        )
        self.refresh_button.pack(side="left", padx=(10, 0))

        self.continue_button = tk.Button(
            button_row,
            text="Continue",
            width=16,
            state="disabled",
            command=self.finish_success,
        )
        self.continue_button.pack(side="right")

        self.cancel_button = tk.Button(
            button_row,
            text="Cancel",
            width=16,
            command=self.root.destroy,
        )
        self.cancel_button.pack(side="right", padx=(0, 10))

    def refresh_status(self) -> None:
        ollama_path = find_ollama_executable()

        if not ollama_path:
            self.status_var.set("Ollama is not installed.")
            self.detail_var.set(
                "I could not find ollama.exe in PATH or in the usual Windows install locations.\n"
                "Click 'Install Ollama' to open the download page, complete the installation, "
                "then click 'Check Again'."
            )
            self.continue_button.config(state="disabled")
            return

        ok, version_text = get_ollama_version(ollama_path)
        if ok:
            self.status_var.set("Ollama is installed.")
            self.detail_var.set(f"Found at:\n{ollama_path}\n\nVersion:\n{version_text}")
            self.continue_button.config(state="normal")
        else:
            self.status_var.set("Ollama was found, but it did not run correctly.")
            self.detail_var.set(f"Found at:\n{ollama_path}\n\nProblem:\n{version_text}")
            self.continue_button.config(state="disabled")

    def open_ollama_download(self) -> None:
        webbrowser.open(OLLAMA_DOWNLOAD_URL)
        messagebox.showinfo(
            "Install Ollama",
            "Your browser has opened the Ollama download page.\n\n"
            "Install Ollama, then return here and click 'Check Again'.",
        )

    def finish_success(self) -> None:
        messagebox.showinfo(
            "Setup complete",
            "Ollama is installed and responding.\n\n"
            "You can move on to the next setup step.",
        )
        self.root.destroy()

    def run(self) -> int:
        self.root.mainloop()
        return 0


def run_setup_wizard() -> int:
    wizard = SetupWizard()
    return wizard.run()


def should_run_setup(argv: list[str]) -> bool:
    return "--setup" in argv or "--setup-wizard" in argv


if __name__ == "__main__":
    if should_run_setup(sys.argv):
        raise SystemExit(run_setup_wizard())

    print("No setup flag detected. Launch with --setup or --setup-wizard.")