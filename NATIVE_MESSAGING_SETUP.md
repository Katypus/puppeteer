# Firefox Native Messaging Setup Guide

This guide explains how to set up the Puppeteer extension to use Firefox native messaging instead of localhost HTTP communication.

## Overview

The new architecture uses Firefox's native messaging protocol for secure IPC (Inter-Process Communication) between the extension and a native Python host, which communicates with the FastAPI backend.

```
Extension ←→ Native Host (Python) ←→ FastAPI Backend
                  (via stdin/stdout)        (via HTTP)
```

## Installation Steps

### 1. Create the Native Messaging Manifest Registry Entry (Windows)

On **Windows**, Firefox reads native messaging host information from the registry. You need to add an entry to:

```
HKEY_CURRENT_USER\Software\Mozilla\NativeMessagingHosts\com.puppeteer.native
```

**Method A: Using Registry Editor (GUI)**

1. Press `Win + R`, type `regedit` and press Enter
2. Navigate to: `HKEY_CURRENT_USER\Software\Mozilla\NativeMessagingHosts`
3. If `NativeMessagingHosts` doesn't exist, create it (right-click on `Mozilla`, select `New > Key`)
4. Right-click in the right pane and create a new `Key` named `com.puppeteer.native`
5. Right-click on the new key and select `New > String Value`
6. Set the value to the path of the manifest file:

```
C:\Users\sapph\Downloads\puppeteer\backend\com.puppeteer.native.json
```

**Method B: Using PowerShell (Automated)**

Run PowerShell as Administrator and execute:

```powershell
$regPath = "HKCU:\Software\Mozilla\NativeMessagingHosts\com.puppeteer.native"
New-Item -Path $regPath -Force | Out-Null
New-ItemProperty -Path $regPath -Name "(Default)" -Value "C:\Users\sapph\Downloads\puppeteer\backend\com.puppeteer.native.json" -Force | Out-Null
```

**Method C: Using .reg File**

Save this as `install_native_host.reg` and double-click it:

```
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Mozilla\NativeMessagingHosts\com.puppeteer.native]
@="C:\\Users\\sapph\\Downloads\\puppeteer\\backend\\com.puppeteer.native.json"
```

### 2. Verify the Native Messaging Manifest

The manifest file at `backend/com.puppeteer.native.json` should look like:

```json
{
  "name": "com.puppeteer.native",
  "description": "Native messaging host for Puppeteer Firefox Extension",
  "path": "C:\\Users\\sapph\\Downloads\\puppeteer\\backend\\puppeteer_native_host.bat",
  "type": "stdio",
  "allowed_extensions": ["puppeteer@example.com"]
}
```

**IMPORTANT:** The `path` field must point to the `.bat` wrapper script, NOT the `.py` file directly. Firefox cannot execute `.py` files directly on Windows.

The batch file wrapper (`puppeteer_native_host.bat`) is provided and calls Python with the correct script path.

### 3. Install Python Dependencies

The native host requires `httpx` for async HTTP requests. Install it:

```bash
pip install httpx
```

Or if using a virtual environment:

```bash
# Inside your puppeteer venv
pip install httpx
```

### 4. Start the FastAPI Backend

In a terminal, run:

```bash
cd c:\Users\sapph\Downloads\puppeteer
python -m backend.app
```

The backend should start on `http://localhost:8000`.

### 5. Load the Extension in Firefox

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on..."**
3. Navigate to `c:\Users\sapph\Downloads\puppeteer\extension`
4. Select `manifest.json` and click Open
5. The extension should now appear in the list with id `puppeteer@example.com`

### 6. Verify the Setup

1. Check the extension console for any errors:
   - Open the Firefox Developer Tools (F12)
   - Go to the **Console** tab
   - Look for messages starting with `[background]`

2. Check the native host logs:
   - The native host writes logs to: `~/.puppeteer_logs/native_host.log`
   - Tail the log file in PowerShell:
     ```powershell
     Get-Content $env:USERPROFILE\.puppeteer_logs\native_host.log -Wait
     ```

3. Test communication:
   - Open a search page (Google, Bing, DuckDuckGo) in Firefox
   - Trigger the decision loop from the popup
   - Check both the extension console and native host logs for messages

## Troubleshooting

### Native Messaging Connection Failed

**Error:** `"Native messaging host not found"` or `"Error: Native messaging host terminated"` or `"An unexpected error occurred"`

**Solutions:**

1. **Check the batch file wrapper exists:**
   ```powershell
   Test-Path "C:\Users\sapph\Downloads\puppeteer\backend\puppeteer_native_host.bat"
   ```
2. **Verify the registry entry exists and is correct:**
   - Open `regedit` and navigate to: `HKCU:\Software\Mozilla\NativeMessagingHosts\com.puppeteer.native`
   - The value should be the full path to `com.puppeteer.native.json`
3. **Check the manifest JSON syntax and path:**
   - The `path` field must point to `.bat` file (not `.py`)
   - Use online JSON validator to check for syntax errors
4. **Test the batch file manually:**
   ```powershell
   cd "C:\Users\sapph\Downloads\puppeteer\backend"
   .\puppeteer_native_host.bat
   ```
   If it starts without errors, press Ctrl+C to exit
5. **Restart Firefox after registry changes**

### Check Native Host Logs

The native host writes detailed logs to: `~/.puppeteer_logs/native_host.log`

**View logs in PowerShell:**

```powershell
# View last 50 lines
Get-Content $env:USERPROFILE\.puppeteer_logs\native_host.log -Tail 50

# Watch logs in real-time
Get-Content $env:USERPROFILE\.puppeteer_logs\native_host.log -Wait
```

**Expected log output when communication works:**

```
2026-04-06 12:34:56,789 - INFO - Native messaging host starting up...
2026-04-06 12:34:56,790 - INFO - httpx imported successfully
2026-04-06 12:34:56,791 - INFO - Native messaging host main loop started
2026-04-06 12:34:57,123 - INFO - Processing message type: API_FETCH
2026-04-06 12:34:57,124 - DEBUG - API_FETCH: POST /decide
```

### Module Not Found: httpx

**Error:** `ModuleNotFoundError: No module named 'httpx'` (in logs)

**Solution:**

```bash
pip install httpx
```

Verify installation:

```bash
python -c "import httpx; print(httpx.__version__)"
```

### Extension Not Communicating

**Symptoms:**

- No errors in Firefox console
- But no decision is made when you trigger the decision loop
- Logs show no API_FETCH messages

**Debugging steps:**

1. **Check FastAPI backend is running:**

   ```bash
   # Should return 200 OK
   curl http://localhost:8000/docs
   ```

2. **Enable extension debug logging:**
   - Open `about:debugging#/runtime/this-firefox` in Firefox
   - Find the Puppeteer extension
   - Click "Inspect" to open the extension developer tools
   - Go to Console tab and look for `[background]` messages

3. **Check native host logs for API errors:**

   ```powershell
   Get-Content $env:USERPROFILE\.puppeteer_logs\native_host.log -Tail 20
   ```

4. **Manually test batch file in CMD:**
   ```cmd
   cd C:\Users\sapph\Downloads\puppeteer\backend
   puppeteer_native_host.bat
   ```

### Python Script Crashes

**Error:** Native host process exits immediately

**Solutions:**

1. **Test the batch file in Command Prompt:**
   ```cmd
   cd C:\Users\sapph\Downloads\puppeteer\backend
   puppeteer_native_host.bat
   ```

   - If it crashes, you'll see the error
2. **Run Python script directly to debug:**
   ```bash
   cd c:\Users\sapph\Downloads\puppeteer\backend
   python native_messaging_host.py
   ```

   - Press Ctrl+C to exit
   - Errors will print to console
3. **Check Python version (must be 3.7+):**

   ```bash
   python --version
   ```

4. **Check for import errors:**
   ```bash
   python -c "import sys; import json; import struct; import logging; import pathlib; import httpx; print('All imports OK')"
   ```

## Architecture Details

### Native Messaging Protocol

Firefox uses a simple stdin/stdout protocol:

- **Message Format:** JSON prefixed with 32-bit little-endian length
- **Communication:** Synchronous request/response via shell pipes
- **Security:** Extension can only communicate with registered native hosts

### Extension Flow

1. **Content Script** extracts page summary
2. **Content Script** sends `PAGE_SUMMARY` message to **Background Script**
3. **Background Script** sends message to **Native Host** via `browser.runtime.sendNativeMessage()`
4. **Native Host** receives JSON via stdin, processes it, sends response via stdout
5. **Background Script** receives response and returns to content script
6. **Content Script** executes decision

### Data Flow

```
Content Script
    ↓ (PAGE_SUMMARY message)
Background Script (background.js)
    ↓ (sendNativeMessage)
Native Host (native_messaging_host.py)
    ↓ (HTTP request)
FastAPI Backend (app.py)
    ↓ (HTTP response)
Native Host (native_messaging_host.py)
    ↓ (stdout)
Background Script (background.js)
    ↓ (decision message)
Content Script
```

## Platform-Specific Notes

### Windows

- Native messaging hosts are registered in the registry
- Manifest JSON must have absolute paths with escaped backslashes
- Python script should have `.py` extension

### Linux

- Manifest file: `~/.mozilla/native-messaging-hosts/com.puppeteer.native.json`
- Path should be a Python script or executable
- Can also use shebang (`#!/usr/bin/env python3`)

### macOS

- Manifest location: `~/Library/Application Support/Mozilla/NativeMessagingHosts/com.puppeteer.native.json`
- Similar to Linux

## References

- [Firefox Native Messaging Documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging)
- [Native Messaging Protocol](https://wiki.mozilla.org/MozillaRules/AddonsPolicy/NativeMessaging)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
