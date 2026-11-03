@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

title Uninstall SIWADI PACD Portal Windows Service
echo ================================================================
echo   UNINSTALLING SIWADI PACD PORTAL WINDOWS SERVICE
echo ================================================================
cd /d "%~dp0"

node uninstall-service-pacd.js

pause