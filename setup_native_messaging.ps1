# Puppeteer Native Messaging Setup Script
# This script sets up native messaging for Firefox without hardcoded paths
# Run as Administrator: powershell -ExecutionPolicy Bypass -File .\setup_native_messaging.ps1

# Get the directory where this script is located
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "backend"
$manifestFile = Join-Path $backendDir "com.puppeteer.native.json"
$batchFile = Join-Path $backendDir "puppeteer_native_host.bat"

# Verify files exist
if (-not (Test-Path $manifestFile)) {
    Write-Host "ERROR: Manifest file not found at $manifestFile" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $batchFile)) {
    Write-Host "ERROR: Batch file not found at $batchFile" -ForegroundColor Red
    exit 1
}

# Convert paths to proper Windows format with escaped backslashes
$manifestPath = $manifestFile -replace '/', '\'
$batchPath = $batchFile -replace '/', '\'

Write-Host "Puppeteer Native Messaging Setup" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host "Installation directory: $scriptDir" -ForegroundColor Cyan
Write-Host "Backend directory: $backendDir" -ForegroundColor Cyan
Write-Host "Manifest file: $manifestPath" -ForegroundColor Cyan
Write-Host "Batch file: $batchPath" -ForegroundColor Cyan
Write-Host ""

# Step 1: Update the manifest file with correct paths
Write-Host "Step 1: Updating manifest file..." -ForegroundColor Yellow
$manifestContent = @{
    name = "com.puppeteer.native"
    description = "Native messaging host for Puppeteer Firefox Extension"
    path = $batchPath
    type = "stdio"
    allowed_extensions = @("puppeteer@example.com")
} | ConvertTo-Json

try {
    $manifestContent | Out-File -FilePath $manifestFile -Encoding UTF8 -Force
    Write-Host "✓ Manifest file updated successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to update manifest file: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Create registry entry
Write-Host "Step 2: Creating registry entry..." -ForegroundColor Yellow
Write-Host "This requires Administrator privileges" -ForegroundColor Yellow

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    exit 1
}

$regPath = "HKCU:\Software\Mozilla\NativeMessagingHosts\com.puppeteer.native"

try {
    # Create the registry key if it doesn't exist
    New-Item -Path $regPath -Force -ErrorAction Stop | Out-Null
    
    # Set the default value to point to the manifest file
    New-ItemProperty -Path $regPath -Name "(Default)" -Value $manifestPath -PropertyType String -Force -ErrorAction Stop | Out-Null
    
    Write-Host "✓ Registry entry created successfully" -ForegroundColor Green
    Write-Host "  Registry path: $regPath" -ForegroundColor Cyan
    Write-Host "  Value: $manifestPath" -ForegroundColor Cyan
} catch {
    Write-Host "ERROR: Failed to create registry entry: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Verify setup
Write-Host ""
Write-Host "Step 3: Verifying setup..." -ForegroundColor Yellow

try {
    $regValue = Get-ItemProperty -Path $regPath -Name "(Default)" -ErrorAction Stop
    $retrievedPath = $regValue."(Default)"
    
    if ($retrievedPath -eq $manifestPath) {
        Write-Host "✓ Registry entry verified successfully" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Registry value doesn't match expected path" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: Failed to verify registry entry: $_" -ForegroundColor Red
    exit 1
}

# Summary
Write-Host ""
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Make sure the FastAPI backend is running:"
Write-Host "   python -m backend.app" -ForegroundColor White
Write-Host ""
Write-Host "2. Install Python dependencies (if not already done):"
Write-Host "   pip install httpx" -ForegroundColor White
Write-Host ""
Write-Host "3. Restart Firefox to activate the native messaging host" -ForegroundColor White
Write-Host ""
Write-Host "If you encounter issues, check:" -ForegroundColor Yellow
Write-Host "- $backendDir\puppeteer_host_crash.log" -ForegroundColor White
Write-Host "- ~/.puppeteer_logs/native_host.log" -ForegroundColor White
