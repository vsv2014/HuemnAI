@echo off
echo ========================================
echo   HUMANE.OS - Dependency Checker
echo ========================================
echo.

cd /d %~dp0

echo Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [X] Python NOT FOUND
    echo     Please install Python 3.8+ from https://www.python.org/
) else (
    python --version
    echo [✓] Python found
)

echo.
echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [X] Node.js NOT FOUND
    echo     Please install Node.js 16+ from https://nodejs.org/
) else (
    node --version
    echo [✓] Node.js found
)

echo.
echo Checking Python packages...
cd backend
python -m pip list | findstr /i "fastapi uvicorn sqlalchemy" >nul 2>&1
if errorlevel 1 (
    echo [X] Python packages missing
    echo     Run: cd backend ^&^& pip install -r requirements.txt
) else (
    echo [✓] Python packages installed
)
cd ..

echo.
echo Checking Node packages...
cd frontend
if exist "node_modules" (
    echo [✓] Node packages installed
) else (
    echo [X] Node packages missing
    echo     Run: cd frontend ^&^& npm install
)
cd ..

echo.
echo ========================================
pause

