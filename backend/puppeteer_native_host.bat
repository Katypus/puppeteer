@echo off
REM Native messaging host wrapper for Puppeteer
REM Prefer bundled executable (release/install builds)
if exist "%~dp0puppeteer-host.exe" (
	"%~dp0puppeteer-host.exe"
	exit /b %errorlevel%
)

REM Fallback for source/dev runs
if exist "%~dp0native_messaging_host.py" (
	python "%~dp0native_messaging_host.py"
	exit /b %errorlevel%
)

echo Native host launcher not found next to batch file. 1>&2
exit /b 1
