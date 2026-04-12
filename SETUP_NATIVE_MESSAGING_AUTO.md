# Quick Native Messaging Setup Guide

This guide explains how to set up native messaging **automatically** without hardcoded paths.

## Why the Old Method Doesn't Work on Other Machines

The original setup used hardcoded paths specific to the developer's machine:

- `C:\Users\sapph\Downloads\puppeteer\...`

On a different machine, these paths don't exist, so Firefox can't find the native host.

## The New Automated Solution

We've created setup scripts that **automatically detect the installation path** and configure everything correctly.

### Method 1: PowerShell (Recommended)

**Requirements:**

- Run as Administrator
- PowerShell available (pre-installed on Windows 10+)

**Steps:**

1. On the test machine, open **PowerShell as Administrator**
2. Navigate to the Puppeteer installation directory:

   ```powershell
   cd "C:\Users\[username]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Puppeteer"
   ```

3. Run the setup script:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\setup_native_messaging.ps1
   ```

4. Follow the on-screen prompts

### Method 2: Batch File (Alternative)

**Requirements:**

- Run as Administrator
- No additional tools needed

**Steps:**

1. On the test machine, open **Command Prompt as Administrator**
2. Navigate to the Puppeteer installation directory:

   ```cmd
   cd "C:\Users\[username]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Puppeteer"
   ```

3. Run the setup script:
   ```cmd
   setup_native_messaging.bat
   ```

## What These Scripts Do

Both setup scripts perform the following:

1. **Detect the installation directory** - based on where the script is located
2. **Update the manifest file** - with absolute paths to your installation
   - File: `backend/com.puppeteer.native.json`
   - Updates the `path` field to point to `puppeteer_native_host.bat`
3. **Create the registry entry** - Firefox uses this to find the native host
   - Path: `HKEY_CURRENT_USER\Software\Mozilla\NativeMessagingHosts\com.puppeteer.native`
   - Value: Points to the manifest file location

## How It Works (Technical Details)

```
Firefox (Extension)
    ↓
Registry Entry (points to manifest)
    ↓
Manifest File (com.puppeteer.native.json)
    ↓
Batch File (puppeteer_native_host.bat, uses %~dp0 for relative paths)
    ↓
Python Script (native_messaging_host.py)
    ↓
FastAPI Backend (localhost:8000)
```

The **batch file uses `%~dp0`** to find the Python script relative to its own location, so it works on any machine regardless of the installation path.

## After Running Setup

1. **Start the FastAPI backend:**

   ```bash
   python -m backend.app
   ```

2. **Ensure httpx is installed:**

   ```bash
   pip install httpx
   ```

3. **Restart Firefox** to activate the native messaging host

4. **Test it:** Open the manage_personas page - it should now work

## Troubleshooting

If you still see "Error: no such native application com.puppeteer.native":

**Check the logs:**

- Crash logs: `backend/puppeteer_host_crash.log`
- Detailed logs: `~/.puppeteer_logs/native_host.log`

**Verify the registry entry:**

```powershell
Get-ItemProperty "HKCU:\Software\Mozilla\NativeMessagingHosts\com.puppeteer.native"
```

**Verify the manifest file exists:**

```powershell
Test-Path "C:\path\to\puppeteer\backend\com.puppeteer.native.json"
```

**Verify the batch file exists:**

```powershell
Test-Path "C:\path\to\puppeteer\backend\puppeteer_native_host.bat"
```

## Manual Setup (If Scripts Fail)

If the automated scripts don't work, you can manually:

1. **Edit the manifest file** (`backend/com.puppeteer.native.json`):

   ```json
   {
     "name": "com.puppeteer.native",
     "description": "Native messaging host for Puppeteer Firefox Extension",
     "path": "C:\\actual\\path\\puppeteer\\backend\\puppeteer_native_host.bat",
     "type": "stdio",
     "allowed_extensions": ["puppeteer@example.com"]
   }
   ```

2. **Create the registry entry** in PowerShell (as Administrator):

   ```powershell
   $regPath = "HKCU:\Software\Mozilla\NativeMessagingHosts\com.puppeteer.native"
   New-Item -Path $regPath -Force | Out-Null
   New-ItemProperty -Path $regPath -Name "(Default)" -Value "C:\actual\path\puppeteer\backend\com.puppeteer.native.json" -Force | Out-Null
   ```

3. **Restart Firefox**
