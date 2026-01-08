# Configuration Guide - HUEMN.Ai

This guide will help you configure the system so all tools work properly.

## 📁 File Locations

### Frontend Configuration
**Path:** `ai/ai/frontend/.env.local`

### Backend Configuration  
**Path:** `ai/ai/backend/.env`

---

## 🚀 Quick Setup (Minimum Required)

### Step 1: Frontend Configuration

1. **Navigate to:** `ai/ai/frontend/`
2. **File:** `.env.local` (already created)
3. **Check this line:**
   ```
   NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001
   ```
   - This should match your backend URL
   - Default is `http://127.0.0.1:8001` (correct for local development)

### Step 2: Backend Configuration

1. **Navigate to:** `ai/ai/backend/`
2. **File:** `.env` (already created)
3. **Minimum required:** No changes needed! The defaults work for basic functionality.

---

## 🔧 Full Configuration Options

### Backend Configuration (`ai/ai/backend/.env`)

#### Basic Settings (Already Set)
```env
ENV=dev
DATABASE_URL=sqlite:///./huemn.db
BACKEND_PORT=8001
DEFAULT_LLM=openai
```

#### Optional: OpenAI Integration
To get real AI responses instead of mock responses:

1. Get an OpenAI API key from: https://platform.openai.com/api-keys
2. Add to `.env`:
   ```env
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

#### Optional: Real Connectors
To connect to real Jira, Zendesk, Salesforce, etc.:

1. Set in `.env`:
   ```env
   USE_REAL_CONNECTORS=1
   ```

2. Add credentials for each service you want to use:

   **Jira:**
   ```env
   JIRA_BASE_URL=https://your-domain.atlassian.net
   JIRA_EMAIL=your-email@example.com
   JIRA_API_TOKEN=your_jira_api_token
   ```

   **Zendesk:**
   ```env
   ZENDESK_SUBDOMAIN=your-subdomain
   ZENDESK_EMAIL=your-email@example.com
   ZENDESK_API_TOKEN=your_zendesk_token
   ```

   **Salesforce:**
   ```env
   SALESFORCE_USERNAME=your_username
   SALESFORCE_PASSWORD=your_password
   SALESFORCE_SECURITY_TOKEN=your_security_token
   ```

   **Greenhouse (for HR):**
   ```env
   GREENHOUSE_API_KEY=your_greenhouse_api_key
   ```

   **LinkedIn (for HR):**
   ```env
   LINKEDIN_API_TOKEN=your_linkedin_token
   LINKEDIN_CLIENT_ID=your_linkedin_client_id
   ```

---

## ✅ Verification Steps

### 1. Check Backend is Running
Open terminal and run:
```bash
curl http://127.0.0.1:8001/health
```
Should return: `{"status":"ok"}`

### 2. Check Frontend Configuration
1. Open `ai/ai/frontend/.env.local`
2. Verify: `NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001`
3. Restart frontend after changing this file

### 3. Test in Browser
1. Open: http://localhost:3000
2. Open browser console (F12)
3. Should see no "Failed to fetch" errors

---

## 🔄 After Making Changes

### Frontend Changes
1. Stop the frontend (Ctrl+C)
2. Restart: `cd ai/ai/frontend && npm run dev`
3. Hard refresh browser (Ctrl+F5)

### Backend Changes
1. Stop the backend (Ctrl+C)
2. Restart: `cd ai/ai && python run_backend.py`
3. Changes take effect immediately

---

## 🛠️ Troubleshooting

### "Failed to fetch" Errors

**Problem:** Frontend can't reach backend

**Solutions:**
1. ✅ Check backend is running: `curl http://127.0.0.1:8001/health`
2. ✅ Check `.env.local` has correct `NEXT_PUBLIC_API_BASE`
3. ✅ Restart frontend after changing `.env.local`
4. ✅ Check firewall isn't blocking port 8001
5. ✅ Try `http://localhost:8001` instead of `http://127.0.0.1:8001`

### Backend Not Starting

**Problem:** Backend won't start

**Solutions:**
1. ✅ Check Python is installed: `python --version`
2. ✅ Install dependencies: `cd ai/ai/backend && pip install -r requirements.txt`
3. ✅ Check port 8001 is free: `netstat -ano | findstr :8001`

### Frontend Not Starting

**Problem:** Frontend won't start

**Solutions:**
1. ✅ Check Node.js is installed: `node --version`
2. ✅ Install dependencies: `cd ai/ai/frontend && npm install`
3. ✅ Check port 3000 is free: `netstat -ano | findstr :3000`

---

## 📝 Configuration File Summary

| File | Location | Purpose |
|------|----------|---------|
| `.env.local` | `ai/ai/frontend/` | Frontend API connection |
| `.env` | `ai/ai/backend/` | Backend settings & API keys |

---

## 🎯 What Works Without Configuration

✅ **Ticketing Tool** - Works with mock data  
✅ **Ticket Assigner** - Works with local database  
✅ **Status Updater** - Works immediately  
✅ **Knowledge AI** - Works with sample data  
✅ **HR Services** - Works with mock LinkedIn/Greenhouse data  

All tools work out of the box! You only need to configure if you want:
- Real AI responses (OpenAI API key)
- Real connector integrations (Jira, Zendesk, etc.)

---

## 🚀 Quick Start (No Configuration Needed!)

1. **Start Backend:**
   ```bash
   cd ai/ai
   python run_backend.py
   ```

2. **Start Frontend:**
   ```bash
   cd ai/ai/frontend
   npm run dev
   ```

3. **Open Browser:**
   ```
   http://localhost:3000
   ```

That's it! Everything works with defaults! 🎉

---

## 🆕 New Features

### Status Widget System
- Appears in header when logged in
- 9 status types (Online, Busy, Away, Lunch, Break, Meeting, Training, On Leave, Offline)
- Work time tracking
- Can be embedded in third-party tools
- See `STATUS_WIDGET_SYSTEM.md` for details

### Analytics Dashboard
- Comprehensive ticket analytics
- SLA metrics and performance tracking
- Employee work time analytics
- Access at: `/chat/analytics-dashboard`
- See `ANALYTICS_DASHBOARD.md` for details

### Email Configuration (Optional)
To enable email sending for demo requests:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@huemn.ai
SMTP_FROM_NAME=HUEMN.Ai Team
SMTP_USE_TLS=1
```

---

## ⚠️ Important: Database Reset

**Development Mode**: When new database models are added, the database is automatically recreated (all tables dropped and recreated). This means:

- ✅ All user accounts are deleted
- ✅ All data is reset
- ✅ Users need to sign up again

**This is normal in development mode.** In production, use database migrations (Alembic) instead. To set up Alembic, install it (`pip install alembic`), then from `ai/backend` run:

```bash
alembic init alembic
# or use the provided alembic/ env.py by running
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

Make sure `DATABASE_URL` points to a production Postgres instance (e.g. `postgresql+psycopg2://user:pass@host/db`).

**If you get a login error:**
1. The database was likely reset
2. Sign up again with a new account
3. You'll get a 14-day free trial automatically

