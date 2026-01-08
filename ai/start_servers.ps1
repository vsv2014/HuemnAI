# HUMANE.OS - Server Startup Script with Dependency Check
# PowerShell script to check dependencies, install if needed, and start servers

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   HUMANE.OS - Server Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Function to check if command exists
function Test-Command {
    param($command)
    $null = Get-Command $command -ErrorAction SilentlyContinue
    return $?
}

# [1/4] Check Python
Write-Host "[1/4] Checking Python installation..." -ForegroundColor Yellow
if (-not (Test-Command "python")) {
    Write-Host "ERROR: Python is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install Python 3.8+ from https://www.python.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
$pythonVersion = python --version 2>&1
Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
Write-Host ""

# [2/4] Check and install Python packages
Write-Host "[2/4] Checking and installing Python packages..." -ForegroundColor Yellow
$requirementsFile = Join-Path $scriptPath "backend\requirements.txt"
if (-not (Test-Path $requirementsFile)) {
    Write-Host "ERROR: requirements.txt not found!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location (Join-Path $scriptPath "backend")
Write-Host "Upgrading pip..." -ForegroundColor Gray
python -m pip install --upgrade pip --quiet 2>&1 | Out-Null

Write-Host "Installing Python packages from requirements.txt..." -ForegroundColor Gray
python -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install Python packages!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✓ Python packages installed" -ForegroundColor Green
Set-Location $scriptPath
Write-Host ""

# [3/4] Check Node.js
Write-Host "[3/4] Checking Node.js installation..." -ForegroundColor Yellow
if (-not (Test-Command "node")) {
    Write-Host "ERROR: Node.js is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install Node.js 16+ from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
$nodeVersion = node --version
Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
Write-Host ""

# [4/4] Check and install Node packages
Write-Host "[4/4] Checking and installing Node packages..." -ForegroundColor Yellow
$packageJson = Join-Path $scriptPath "frontend\package.json"
if (-not (Test-Path $packageJson)) {
    Write-Host "ERROR: package.json not found!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location (Join-Path $scriptPath "frontend")
$nodeModules = Join-Path (Get-Location) "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "Installing Node.js packages (this may take a few minutes)..." -ForegroundColor Gray
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install Node packages!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "Checking for missing packages..." -ForegroundColor Gray
    npm install
}
Write-Host "✓ Node packages ready" -ForegroundColor Green
Set-Location $scriptPath
Write-Host ""

# Start servers
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Starting Servers..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Starting Backend Server on port 8001..." -ForegroundColor Yellow
$backendPath = Join-Path $scriptPath "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; python run_backend.py" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "Starting Frontend Server on port 3000..." -ForegroundColor Yellow
$frontendPath = Join-Path $scriptPath "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Servers Starting!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://127.0.0.1:8001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Both servers are starting in separate windows." -ForegroundColor White
Write-Host "Wait 30-60 seconds for frontend to compile." -ForegroundColor Yellow
Write-Host "Close those windows to stop the servers." -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit this window (servers will keep running)..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
