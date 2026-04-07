#!/usr/bin/env python3
"""
Test script to verify Firefox native messaging host setup and connectivity.
Run this to diagnose issues with the Puppeteer extension.
"""

import subprocess
import json
import sys
import os
from pathlib import Path

def print_header(text):
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)

def print_result(label, status, details=""):
    emoji = "✓" if status else "✗"
    print(f"[{emoji}] {label}")
    if details:
        print(f"    {details}")

def check_batch_file():
    print_header("1. Checking Batch File")
    batch_path = Path("C:\\Users\\sapph\\Downloads\\puppeteer\\backend\\puppeteer_native_host.bat")
    exists = batch_path.exists()
    print_result("Batch file exists", exists, str(batch_path))
    return exists

def check_manifest():
    print_header("2. Checking Manifest File")
    manifest_path = Path("C:\\Users\\sapph\\Downloads\\puppeteer\\backend\\com.puppeteer.native.json")
    exists = manifest_path.exists()
    print_result("Manifest exists", exists, str(manifest_path))
    
    if exists:
        try:
            with open(manifest_path) as f:
                data = json.load(f)
            print_result("Manifest JSON valid", True)
            print(f"    Path field: {data.get('path')}")
            bat_correct = data.get('path', '').endswith('.bat')
            print_result("Path points to .bat file", bat_correct)
            return True
        except Exception as e:
            print_result("Parse manifest JSON", False, str(e))
            return False
    return False

def check_python():
    print_header("3. Checking Python")
    try:
        result = subprocess.run(["python", "--version"], capture_output=True, text=True, timeout=5)
        version = result.stdout.strip()
        print_result("Python installed", True, version)
        
        # Check version is 3.7+
        version_num = float(version.split()[-1].split('.')[:2])
        if version_num >= 3.7:
            print_result("Python version 3.7+", True)
        else:
            print_result("Python version 3.7+", False, f"Got {version}")
        return True
    except Exception as e:
        print_result("Python installed", False, str(e))
        return False

def check_httpx():
    print_header("4. Checking httpx Package")
    try:
        import httpx
        print_result("httpx installed", True, f"Version {httpx.__version__}")
        return True
    except ImportError:
        print_result("httpx installed", False, "Run: pip install httpx")
        return False

def check_native_host_script():
    print_header("5. Checking Native Host Python Script")
    script_path = Path("C:\\Users\\sapph\\Downloads\\puppeteer\\backend\\native_messaging_host.py")
    exists = script_path.exists()
    print_result("Script exists", exists, str(script_path))
    
    if exists:
        # Check syntax
        try:
            result = subprocess.run(
                ["python", "-m", "py_compile", str(script_path)],
                capture_output=True,
                text=True,
                timeout=5
            )
            valid = result.returncode == 0
            print_result("Python syntax valid", valid)
            if not valid:
                print(f"    Error: {result.stderr}")
            return valid
        except Exception as e:
            print_result("Check syntax", False, str(e))
            return False
    return False

def check_registry():
    print_header("6. Checking Windows Registry")
    try:
        result = subprocess.run(
            ["reg", "query", "HKCU\\Software\\Mozilla\\NativeMessagingHosts\\com.puppeteer.native"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print_result("Registry entry exists", True)
            if "com.puppeteer.native.json" in result.stdout:
                print_result("Points to manifest file", True)
                return True
            else:
                print_result("Points to manifest file", False, "Registry value is incorrect")
                return False
        else:
            print_result("Registry entry exists", False, "Create it using the setup guide")
            return False
    except Exception as e:
        print_result("Check registry", False, str(e))
        return False

def check_backend():
    print_header("7. Checking FastAPI Backend")
    try:
        import httpx
        response = httpx.get("http://localhost:8000/docs", timeout=5)
        if response.status_code == 200:
            print_result("Backend is running", True, "http://localhost:8000")
            return True
        else:
            print_result("Backend is running", False, f"Status code: {response.status_code}")
            return False
    except Exception as e:
        print_result("Backend is running", False, "Start with: python -m backend.app")
        return False

def check_logs():
    print_header("8. Checking Native Host Logs")
    log_file = Path.home() / ".puppeteer_logs" / "native_host.log"
    exists = log_file.exists()
    print_result("Log file exists", exists, str(log_file))
    
    if exists:
        try:
            with open(log_file) as f:
                lines = f.readlines()
            print(f"    Total lines: {len(lines)}")
            if lines:
                print("    Recent entries:")
                for line in lines[-5:]:
                    print(f"      {line.rstrip()}")
            return True
        except Exception as e:
            print_result("Read log file", False, str(e))
            return False
    else:
        print("    (Log file will be created on first use)")
        return None

def main():
    print("\n" + "█" * 60)
    print("  Firefox Native Messaging Setup Verification")
    print("█" * 60)
    
    results = {
        "Batch File": check_batch_file(),
        "Manifest": check_manifest(),
        "Python": check_python(),
        "httpx": check_httpx(),
        "Native Host Script": check_native_host_script(),
        "Registry": check_registry(),
        "Backend": check_backend(),
        "Logs": check_logs(),
    }
    
    print_header("Summary")
    passed = sum(1 for v in results.values() if v is True)
    total = len([v for v in results.values() if v is not None])
    print(f"Setup Status: {passed}/{total} checks passed")
    
    if passed == total:
        print("\n✓ All checks passed! The setup should be working.")
        print("  Try testing the extension with Firefox.")
    else:
        print("\n✗ Some checks failed. See details above.")
        print("  Follow the recommendations to fix the issues.")
    
    print("\n" + "█" * 60 + "\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nTest interrupted.")
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
