# HUMANE.OS - Complete Setup Guide for New Computers

This comprehensive guide will help you set up and run the HUMANE.OS application on any computer (Windows, macOS, or Linux).

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Installing Dependencies](#installing-dependencies)
4. [Starting the Servers](#starting-the-servers)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Platform-Specific Instructions](#platform-specific-instructions)

---

## 🔧 Prerequisites

Before you begin, ensure you have the following installed on your computer:

### Required Software

1. **Python 3.8 or higher**
   - Download from: https://www.python.org/downloads/
   - **Important:** During installation, check "Add Python to PATH"
   - Verify installation: `python --version` or `python3 --version`

2. **Node.js 16 or higher (includes npm)**
   - Download from: https://nodejs.org/
   - Verify installation: `node --version` and `npm --version`

3. **Git (Optional, for cloning repository)**
   - Download from: https://git-scm.com/downloads

### Verify Prerequisites

**Windows (Command Prompt or PowerShell):**
```cmd
python --version
node --version
npm --version
```

**macOS/Linux:**
```bash
python3 --version
node --version
npm --version
```

---

## 📦 Initial Setup

### Step 1: Get the Project Files

**Option A: If you have the project folder**
- Copy the entire project folder to your computer
- Navigate to the project root: `ai/ai/`

**Option B: If cloning from repository**
```bash
git clone <repository-url>
cd ai/ai
```

### Step 2: Navigate to Project Root

**Windows:**
```cmd
cd C:\path\to\ai\ai\ai
```

**macOS/Linux:**
```bash
cd /path/to/ai/ai/ai
```

---

## 📥 Installing Dependencies

### Step 1: Install Python Packages (Backend)

**Windows:**
```cmd
cd backend
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ..
```

**macOS/Linux:**
```bash
cd backend
python3 -m pip install --upgrade pip
pip3 install -r requirements.txt
cd ..
```

**Expected output:** All packages will be installed. This may take 2-5 minutes on first run.

**Required Python packages:**
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
- PyJWT
- email-validator
- cryptography
- beautifulsoup4
- lxml
- python-multipart
- PyPDF2
- python-docx
- twilio

### Step 2: Install Node.js Packages (Frontend)

**All Platforms:**
```bash
cd frontend
npm install
cd ..
```

**Expected output:** All packages will be installed. This may take 2-5 minutes on first run.

**Required Node.js packages:**
- next
- react
- react-dom
- zustand
- react-parallax-tilt
- lottie-react
- reactflow
- recharts
- tailwindcss
- typescript

---

## 🚀 Starting the Servers

### Method 1: Automated Script (Easiest - Windows Only)

**Windows:**
1. Navigate to `ai/ai/` folder
2. Double-click `start_servers.bat`
3. Wait 30-60 seconds for servers to start
4. Open browser: http://localhost:3000

**What the script does:**
- ✅ Checks if Python and Node.js are installed
- ✅ Installs missing Python packages
- ✅ Installs missing Node.js packages
- ✅ Starts backend server in a new window
- ✅ Starts frontend server in a new window

### Method 2: Manual Start (All Platforms)

You need **TWO separate terminal windows** - one for backend, one for frontend.

#### Terminal 1: Start Backend Server

**Windows:**
```cmd
cd ai\ai
python run_backend.py
```

**macOS/Linux:**
```bash
cd ai/ai
python3 run_backend.py
```

**Expected output:**
```
Starting backend on http://0.0.0.0:8001 (app from backend/app.main:app)
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8001
```

**Backend URL:** http://127.0.0.1:8001

#### Terminal 2: Start Frontend Server

**Open a NEW terminal window and run:**

**Windows:**
```cmd
cd ai\ai\frontend
npm run dev
```

**macOS/Linux:**
```bash
cd ai/ai/frontend
npm run dev
```

**Expected output:**
```
- ready started server on 0.0.0.0:3000
- Local:        http://localhost:3000
```

**Frontend URL:** http://localhost:3000

**Note:** Frontend compilation may take 30-60 seconds on first start.

---

## ✅ Verification

### Check Backend Server

**Option 1: Browser**
- Open: http://127.0.0.1:8001/health
- Should display: `{"status":"ok"}`

**Option 2: Command Line**

**Windows (PowerShell):**
```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8001/health" -UseBasicParsing
```

**macOS/Linux:**
```bash
curl http://127.0.0.1:8001/health
```

**Option 3: API Documentation**
- Open: http://127.0.0.1:8001/docs
- Should show FastAPI interactive documentation

### Check Frontend Server

- Open browser: http://localhost:3000
- Should display the HUMANE.OS application interface

### Check Both Servers Are Running

**Windows:**
```cmd
netstat -ano | findstr ":8001 :3000"
```

**macOS/Linux:**
```bash
lsof -i :8001 -i :3000
```

You should see both ports in use.

---

## 🛑 Stopping the Servers

### If using automated script:
- Close the server windows (backend and frontend)

### If running manually:
- In each terminal window, press `Ctrl+C`
- Wait for graceful shutdown

---

## 🔍 Troubleshooting

### Issue: Python not found

**Solution:**
1. Verify Python is installed: `python --version`
2. If not installed, download from https://www.python.org/
3. **Important:** Check "Add Python to PATH" during installation
4. Restart terminal after installation

**Alternative (if python doesn't work):**
- Try `python3` instead of `python`
- Or use full path: `C:\Python39\python.exe` (Windows) or `/usr/bin/python3` (Linux/Mac)

### Issue: Node.js not found

**Solution:**
1. Verify Node.js is installed: `node --version`
2. If not installed, download from https://nodejs.org/
3. Restart terminal after installation

### Issue: pip install fails

**Solution:**
```bash
# Upgrade pip first
python -m pip install --upgrade pip

# Then try installing again
cd backend
pip install -r requirements.txt
```

**If using Python 3:**
```bash
python3 -m pip install --upgrade pip
pip3 install -r requirements.txt
```

### Issue: npm install fails

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
cd frontend
rmdir /s node_modules  # Windows
# OR
rm -rf node_modules    # macOS/Linux
del package-lock.json  # Windows
# OR
rm package-lock.json   # macOS/Linux

# Reinstall
npm install
```

### Issue: Port 8001 already in use (Backend)

**Windows:**
```cmd
# Find process using port 8001
netstat -ano | findstr :8001

# Kill the process (replace <PID> with actual process ID)
taskkill /PID <PID> /F
```

**macOS/Linux:**
```bash
# Find process using port 8001
lsof -ti:8001

# Kill the process
kill -9 $(lsof -ti:8001)
```

### Issue: Port 3000 already in use (Frontend)

**Windows:**
```cmd
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace <PID> with actual process ID)
taskkill /PID <PID> /F
```

**macOS/Linux:**
```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)
```

### Issue: Backend won't start

**Check:**
1. Are you in the correct directory? (`ai/ai/`)
2. Are all Python packages installed? (`pip list`)
3. Check for error messages in the terminal
4. Verify database file exists: `backend/humane.db`

**Common errors:**
- **ModuleNotFoundError:** Run `pip install -r requirements.txt` again
- **Port already in use:** See port troubleshooting above
- **Database error:** May need to initialize database (check `backend/check_and_init_db.py`)

### Issue: Frontend won't start

**Check:**
1. Are you in the correct directory? (`ai/ai/frontend/`)
2. Are all Node packages installed? (`npm list`)
3. Check for error messages in the terminal
4. Try deleting `node_modules` and reinstalling

**Common errors:**
- **Module not found:** Run `npm install` again
- **Port already in use:** See port troubleshooting above
- **TypeScript errors:** May need to rebuild: `npm run build` then `npm run dev`

### Issue: Frontend can't connect to backend

**Check:**
1. Is backend running? Check http://127.0.0.1:8001/health
2. Check browser console for CORS errors
3. Verify backend is accessible from frontend
4. Check firewall settings

---

## 💻 Platform-Specific Instructions

### Windows

**Recommended: Use Command Prompt or PowerShell**

**Quick Start:**
```cmd
cd ai\ai
start_servers.bat
```

**Manual Start:**
```cmd
REM Terminal 1 - Backend
cd ai\ai
python run_backend.py

REM Terminal 2 - Frontend (new window)
cd ai\ai\frontend
npm run dev
```

### macOS

**Recommended: Use Terminal**

**Quick Start:**
```bash
cd ai/ai
# No automated script, use manual method
```

**Manual Start:**
```bash
# Terminal 1 - Backend
cd ai/ai
python3 run_backend.py

# Terminal 2 - Frontend (new terminal window)
cd ai/ai/frontend
npm run dev
```

### Linux

**Recommended: Use Terminal**

**Quick Start:**
```bash
cd ai/ai
# No automated script, use manual method
```

**Manual Start:**
```bash
# Terminal 1 - Backend
cd ai/ai
python3 run_backend.py

# Terminal 2 - Frontend (new terminal window)
cd ai/ai/frontend
npm run dev
```

---

## 📍 Access URLs

Once both servers are running:

- **Frontend Application:** http://localhost:3000
- **Backend API:** http://127.0.0.1:8001
- **Backend Health Check:** http://127.0.0.1:8001/health
- **Backend API Documentation:** http://127.0.0.1:8001/docs
- **Backend Alternative Docs:** http://127.0.0.1:8001/redoc

---

## 📝 Quick Reference Commands

| Action | Windows Command | macOS/Linux Command |
|--------|----------------|---------------------|
| **Check Python** | `python --version` | `python3 --version` |
| **Check Node.js** | `node --version` | `node --version` |
| **Install backend packages** | `cd backend && pip install -r requirements.txt` | `cd backend && pip3 install -r requirements.txt` |
| **Install frontend packages** | `cd frontend && npm install` | `cd frontend && npm install` |
| **Start backend** | `cd ai\ai && python run_backend.py` | `cd ai/ai && python3 run_backend.py` |
| **Start frontend** | `cd ai\ai\frontend && npm run dev` | `cd ai/ai/frontend && npm run dev` |
| **Check backend health** | `curl http://127.0.0.1:8001/health` | `curl http://127.0.0.1:8001/health` |
| **Stop servers** | `Ctrl+C` in each terminal | `Ctrl+C` in each terminal |

---

## 🎯 First-Time Setup Checklist

- [ ] Install Python 3.8+ (with PATH option checked)
- [ ] Install Node.js 16+ (includes npm)
- [ ] Verify installations (`python --version`, `node --version`)
- [ ] Navigate to project root (`ai/ai/`)
- [ ] Install backend packages (`cd backend && pip install -r requirements.txt`)
- [ ] Install frontend packages (`cd frontend && npm install`)
- [ ] Start backend server (Terminal 1)
- [ ] Start frontend server (Terminal 2)
- [ ] Verify backend: http://127.0.0.1:8001/health
- [ ] Verify frontend: http://localhost:3000

---

## 💡 Tips for Success

1. **Use the automated script on Windows** - It handles everything automatically
2. **Keep both terminals open** - Both servers must run simultaneously
3. **Wait for compilation** - Frontend takes 30-60 seconds on first start
4. **Check for errors** - Look at terminal output for any error messages
5. **Hard refresh browser** - Press `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac) if you see old content
6. **First time setup** - Allow 5-10 minutes for all package installations
7. **Network access** - Backend runs on `0.0.0.0:8001`, accessible from network
8. **Database** - SQLite database (`humane.db`) is created automatically

---

## 📞 Need Help?

If you encounter issues not covered in this guide:

1. Check the terminal output for specific error messages
2. Verify all prerequisites are installed correctly
3. Ensure ports 8001 and 3000 are not in use by other applications
4. Try restarting your computer if installation issues persist
5. Check the `START_SERVERS.md` file for additional information

---

## ✅ Success Indicators

You'll know everything is working when:

- ✅ Backend terminal shows: `Uvicorn running on http://0.0.0.0:8001`
- ✅ Frontend terminal shows: `ready started server on 0.0.0.0:3000`
- ✅ http://127.0.0.1:8001/health returns `{"status":"ok"}`
- ✅ http://localhost:3000 displays the application interface
- ✅ No error messages in either terminal

---

**Congratulations!** Your HUMANE.OS application is now running! 🎉

---

*Last Updated: 2024*
*For the latest updates, check the project repository.*


