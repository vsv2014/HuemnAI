
@echo off
echo ========================================
echo   HUEMN.Ai - Server Startup
echo ========================================
echo.

REM Change to project directory
cd /d %~dp0

echo [1/4] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH!
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)
python --version
echo ✓ Python found
echo.

echo [2/4] Checking and installing Python packages...
cd backend
if not exist "requirements.txt" (
    echo ERROR: requirements.txt not found!
    pause
    exit /b 1
)
python -m pip install --upgrade pip >nul 2>&1
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install Python packages!
    pause
    exit /b 1
)
echo ✓ Python packages installed
cd ..
echo.

echo [3/4] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH!
    echo Please install Node.js 16+ from https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo ✓ Node.js found
echo.

echo [4/4] Checking and installing Node packages...
cd frontend
if not exist "package.json" (
    echo ERROR: package.json not found!
    pause
    exit /b 1
)
if not exist "node_modules" (
    echo Installing Node.js packages (this may take a few minutes)...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install Node packages!
        pause
        exit /b 1
    )
) else (
    echo Checking for missing packages...
    call npm install
)
echo ✓ Node packages ready
cd ..
echo.

echo ========================================
echo   Starting Servers...
echo ========================================
echo.

echo Starting Backend Server on port 8001...
start "HUEMN.Ai Backend" cmd /k "cd /d %~dp0backend && python run_backend.py"
timeout /t 3 /nobreak >nul

echo Starting Frontend Server on port 3000...
start "HUEMN.Ai Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   Servers Starting!
echo ========================================
echo.
echo Backend:  http://127.0.0.1:8001
echo Frontend: http://localhost:3000
echo.
echo Both servers are starting in separate windows.
echo Wait 30-60 seconds for frontend to compile.
echo Close those windows to stop the servers.
echo.
echo Press any key to close this window (servers will keep running)...
pause >nul
