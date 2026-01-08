# Restart Backend Server
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Stopping existing backend processes..." -ForegroundColor Yellow
Get-Process | Where-Object {
    $_.MainWindowTitle -like "*HUMANE.OS Backend*" -or
    $_.CommandLine -like "*run_backend*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

Write-Host "Starting Backend Server on port 8001..." -ForegroundColor Yellow
$backendPath = Join-Path $scriptPath "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; cd ..; python run_backend.py" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "Backend server restarted!" -ForegroundColor Green
Write-Host "Backend URL: http://127.0.0.1:8001" -ForegroundColor Cyan

