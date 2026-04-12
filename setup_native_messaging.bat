@echo off
REM Puppeteer Native Messaging Setup Script (Windows Batch)
REM Run as Administrator: setup_native_messaging.bat

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set "scriptDir=%~dp0"
set "backendDir=%scriptDir%backend"
set "manifestFile=%backendDir%\com.puppeteer.native.json"
set "batchFile=%backendDir%\puppeteer_native_host.bat"

REM Verify files exist
if not exist "%manifestFile%" (
    echo ERROR: Manifest file not found at %manifestFile%
    exit /b 1
)

if not exist "%batchFile%" (
    echo ERROR: Batch file not found at %batchFile%
    exit /b 1
)

echo.
echo Puppeteer Native Messaging Setup
echo =================================
echo Installation directory: %scriptDir%
echo Backend directory: %backendDir%
echo Manifest file: %manifestFile%
echo Batch file: %batchFile%
echo.

REM Step 1: Create a Python script to update the manifest and registry
set "pythonScript=%scriptDir%setup_helper.py"

(
echo import json
echo import sys
echo import winreg
echo from pathlib import Path
echo.
echo manifest_path = r"%manifestFile%"
echo batch_path = r"%batchFile%"
echo.
echo # Update manifest file
echo manifest_data = {
echo     "name": "com.puppeteer.native",
echo     "description": "Native messaging host for Puppeteer Firefox Extension",
echo     "path": batch_path,
echo     "type": "stdio",
echo     "allowed_extensions": ["puppeteer@example.com"]
echo }
echo.
echo with open(manifest_path, 'w' ^) as f:
echo     json.dump(manifest_data, f, indent=2^)
echo print(f'Manifest updated: {manifest_path}'^)
echo.
echo # Create registry entry
echo try:
echo     key = winreg.CreateKey(winreg.HKEY_CURRENT_USER, r'Software\Mozilla\NativeMessagingHosts\com.puppeteer.native'^)
echo     winreg.SetValueEx(key, '', 0, winreg.REG_SZ, manifest_path^)
echo     winreg.CloseKey(key^)
echo     print(f'Registry entry created successfully'^)
echo except Exception as e:
echo     print(f'Failed to create registry entry: {e}'^)
echo     sys.exit(1^)
) > "%pythonScript%"

REM Run the Python helper script
echo Step 1: Updating manifest and registry...
python "%pythonScript%"
if errorlevel 1 (
    echo ERROR: Setup failed
    del "%pythonScript%"
    exit /b 1
)

REM Clean up the helper script
del "%pythonScript%"

echo.
echo Setup Complete!
echo ============================================
echo Next steps:
echo 1. Make sure the FastAPI backend is running:
echo    python -m backend.app
echo.
echo 2. Install Python dependencies (if not already done^):
echo    pip install httpx
echo.
echo 3. Restart Firefox to activate the native messaging host
echo.
echo If you encounter issues, check:
echo - %backendDir%\puppeteer_host_crash.log
echo - %USERPROFILE%\.puppeteer_logs\native_host.log
