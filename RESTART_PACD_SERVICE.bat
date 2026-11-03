@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

title Restart SIWADI PACD Portal Service
echo ============================================
echo    Restarting SIWADI PACD Portal Service...
echo ============================================

powershell -Command "$svc = Get-Service | Where-Object { $_.Name -like '*pacd*' -or $_.DisplayName -like '*pacd*' }; if ($svc) { Restart-Service -Name $svc.Name -Force; Write-Host ('[OK] Restarted service: ' + $svc.Name) } else { Write-Host '[X] Walang nahanap na PACD service!' -ForegroundColor Red }"

echo.
echo ============================================
echo    DONE! Na-apply na ang updated PACD code.
echo ============================================
pause