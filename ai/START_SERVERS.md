# How to Start HUMANE.OS Servers

This guide provides multiple ways to start both the backend and frontend servers with automatic dependency checking.

## 📁 File Locations

- **Backend:** `ai/ai/backend/`
- **Frontend:** `ai/ai/frontend/`
- **Start Scripts:** `ai/ai/` (this directory)

---

## 🚀 Quick Start (Easiest Method)

### Option 1: Double-Click Script (Windows) - RECOMMENDED

1. **Navigate to:** `ai/ai/`
2. **Double-click:** `start_servers.bat`
3. The script will:
   - ✅ Check if Python is installed
   - ✅ Check if Node.js is installed
   - ✅ Install Python packages (if missing)
   - ✅ Install Node packages (if missing)
   - ✅ Start both servers in separate windows
4. Wait 30-60 seconds for servers to start
5. Open: http://localhost:3000

### Option 2: PowerShell Script

1. **Navigate to:** `ai/ai/`
2. **Right-click:** `start_servers.ps1`
3. **Select:** "Run with PowerShell"
4. Same automatic checks and installation
5. Open: http://localhost:3000

---

## 📝 Manual Start (Step-by-Step)

### Step 1: Check Dependencies

**Check if everything is installed:**
```bash
cd ai/ai
check_dependencies.bat
```

### Step 2: Install Python Packages (if needed)

```bash
cd ai/ai/backend
pip install -r requirements.txt
```

### Step 3: Install Node Packages (if needed)

```bash
cd ai/ai/frontend
npm install
```

### Step 4: Start Backend Server

**Open a terminal/command prompt and run:**

```bash
cd ai/ai/backend
python run_backend.py
```

**Or from project root:**
```bash
cd ai/ai
python run_backend.py
```

**Backend will start on:** http://127.0.0.1:8001

### Step 5: Start Frontend Server

**Open a NEW terminal/command prompt and run:**

```bash
cd ai/ai/frontend
npm run dev
```

**Frontend will start on:** http://localhost:3000

---

## 🔧 Detailed Commands

### Windows (Command Prompt)

```cmd
REM Check dependencies first
cd C:\Users\srava\Downloads\ai\ai\ai
check_dependencies.bat

REM Install Python packages (if needed)
cd backend
pip install -r requirements.txt
cd ..

REM Install Node packages (if needed)
cd frontend
npm install
cd ..

REM Terminal 1 - Backend
cd C:\Users\srava\Downloads\ai\ai\ai
python run_backend.py

REM Terminal 2 - Frontend (open new window)
cd C:\Users\srava\Downloads\ai\ai\ai\frontend
npm run dev
```

### Windows (PowerShell)

```powershell
# Check dependencies first
cd C:\Users\srava\Downloads\ai\ai\ai
.\check_dependencies.bat

# Install Python packages (if needed)
cd backend
pip install -r requirements.txt
cd ..

# Install Node packages (if needed)
cd frontend
npm install
cd ..

# Terminal 1 - Backend
cd C:\Users\srava\Downloads\ai\ai\ai
python run_backend.py

# Terminal 2 - Frontend (open new terminal)
cd C:\Users\srava\Downloads\ai\ai\ai\frontend
npm run dev
```

### Linux/Mac

```bash
# Check Python
python3 --version

# Install Python packages
cd ai/ai/backend
pip3 install -r requirements.txt
cd ..

# Check Node
node --version

# Install Node packages
cd ai/ai/frontend
npm install
cd ..

# Terminal 1 - Backend
cd ai/ai
python3 run_backend.py

# Terminal 2 - Frontend (open new terminal)
cd ai/ai/frontend
npm run dev
```

---

## ✅ Verification

### Check Dependencies
```bash
cd ai/ai
check_dependencies.bat
```

### Check Backend
```bash
curl http://127.0.0.1:8001/health
```
Should return: `{"status":"ok"}`

### Check Frontend
Open browser: http://localhost:3000

---

## 📦 Required Packages

### Backend (Python)
- fastapi
- uvicorn[standard]
- python-dotenv
- sqlalchemy
- pydantic
- pydantic-settings
- python-jose
- pytest
- httpx
- requests
- openai

**Install command:**
```bash
cd backend
pip install -r requirements.txt
```

### Frontend (Node.js)
- next
- react
- react-dom
- zustand
- react-parallax-tilt
- lottie-react
- tailwindcss
- typescript

**Install command:**
```bash
cd frontend
npm install
```

---

## 🛑 Stopping Servers

### If using start scripts:
- Close the server windows

### If running manually:
- Press `Ctrl+C` in each terminal window

---

## 📋 Prerequisites

### Backend Requirements
- **Python 3.8+** - Download from https://www.python.org/
- **pip** - Usually comes with Python

### Frontend Requirements
- **Node.js 16+** - Download from https://nodejs.org/
- **npm** - Comes with Node.js

---

## 🔍 Troubleshooting

### Python not found
```bash
# Check if Python is installed
python --version

# If not found, install from: https://www.python.org/
# Make sure to check "Add Python to PATH" during installation
```

### Node.js not found
```bash
# Check if Node.js is installed
node --version

# If not found, install from: https://nodejs.org/
```

### Backend packages won't install
```bash
# Upgrade pip first
python -m pip install --upgrade pip

# Then install packages
cd backend
pip install -r requirements.txt
```

### Frontend packages won't install
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
cd frontend
rmdir /s node_modules
del package-lock.json

# Reinstall
npm install
```

### Port already in use
```bash
# Windows - Find and kill process on port 8001
netstat -ano | findstr :8001
taskkill /PID <PID> /F

# Windows - Find and kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## 📍 Access URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://127.0.0.1:8001
- **Health Check:** http://127.0.0.1:8001/health
- **API Docs:** http://127.0.0.1:8001/docs (FastAPI auto-generated)

---

## 🎯 Quick Reference

| Action | Command |
|--------|---------|
| **Start both (auto-install)** | Double-click `start_servers.bat` |
| **Check dependencies** | `check_dependencies.bat` |
| **Install backend packages** | `cd backend && pip install -r requirements.txt` |
| **Install frontend packages** | `cd frontend && npm install` |
| **Start backend** | `cd ai/ai && python run_backend.py` |
| **Start frontend** | `cd ai/ai/frontend && npm run dev` |
| **Check backend** | `curl http://127.0.0.1:8001/health` |
| **Stop servers** | `Ctrl+C` in each terminal |

---

## 💡 Tips

1. **Use the batch file** - It does everything automatically!
2. **Keep both terminals open** - You need both servers running
3. **Wait for compilation** - Frontend takes 30-60 seconds on first start
4. **Check console** - Look for errors in the terminal windows
5. **Hard refresh browser** - Press `Ctrl+F5` if you see old content
6. **First time setup** - May take 2-5 minutes to install all packages

---

## 🚀 What the Script Does

When you run `start_servers.bat`, it automatically:

1. ✅ Checks if Python is installed
2. ✅ Checks if Node.js is installed
3. ✅ Upgrades pip to latest version
4. ✅ Installs all Python packages from `requirements.txt`
5. ✅ Installs all Node packages (if `node_modules` missing)
6. ✅ Starts backend server in a new window
7. ✅ Starts frontend server in a new window
8. ✅ Shows you the access URLs

**You don't need to do anything manually!** 🎉

---

That's it! Your servers should now be running. 🚀
