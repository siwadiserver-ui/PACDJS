@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

title Install SIWADI PACD Portal Windows Service
echo ================================================================
echo   INSTALLING SIWADI PACD PORTAL WINDOWS SERVICE (PORT 3001)
echo ================================================================
cd /d "%~dp0"

node install-service-pacd.js

pause