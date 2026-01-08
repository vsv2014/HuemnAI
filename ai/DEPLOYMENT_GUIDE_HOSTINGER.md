# 🚀 Deployment Guide: HUEMN.Ai to Hostinger

This guide will walk you through deploying your HUEMN.Ai application to Hostinger.

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Hostinger Hosting Options](#hostinger-hosting-options)
3. [Option 1: VPS Hosting (Recommended)](#option-1-vps-hosting-recommended)
4. [Option 2: Shared Hosting + External Backend](#option-2-shared-hosting--external-backend)
5. [Domain Configuration](#domain-configuration)
6. [SSL/HTTPS Setup](#sslhttps-setup)
7. [Post-Deployment Checklist](#post-deployment-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:
- ✅ Hostinger account with active hosting plan
- ✅ Domain name configured in Hostinger
- ✅ SSH access (for VPS) or FTP access (for shared hosting)
- ✅ Basic knowledge of terminal/command line

---

## Hostinger Hosting Options

### Option A: VPS Hosting (Best for Full Stack Apps)
- **Pros**: Full control, can run both frontend and backend
- **Cons**: Requires server management knowledge
- **Cost**: ~$4-10/month

### Option B: Shared Hosting + External Backend
- **Pros**: Easier setup, managed hosting
- **Cons**: Backend needs separate hosting (Railway, Render, etc.)
- **Cost**: ~$2-5/month (Hostinger) + Backend hosting

**We recommend Option A (VPS) for simplicity and cost-effectiveness.**

---

## Option 1: VPS Hosting (Recommended)

### Step 1: Prepare Your Application

#### 1.1 Create Production Environment Files

**Frontend** (`ai/ai/frontend/.env.production`):
```env
NEXT_PUBLIC_API_BASE=https://yourdomain.com/api
# Or if backend is on different subdomain:
# NEXT_PUBLIC_API_BASE=https://api.yourdomain.com
```

**Backend** (`ai/ai/backend/.env.production`):
```env
ENV=production
DATABASE_URL=sqlite:///./huemn.db
# For PostgreSQL (recommended for production):
# DATABASE_URL=postgresql://user:password@localhost:5432/huemn_db

SECRET_KEY=your-super-secret-key-change-this-in-production
BACKEND_PORT=8001
BACKEND_HOST=0.0.0.0

# CORS - Update with your domain
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# LLM Configuration (set via UI, but can set defaults here)
DEFAULT_LLM=openai
```

#### 1.2 Update Next.js Config for Production

Update `ai/ai/frontend/next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // For easier deployment
  turbopack: {
    root: __dirname,
  },
  // Add if you have image optimization issues
  images: {
    unoptimized: true, // Disable if you have image optimization issues
  },
};

module.exports = nextConfig;
```

#### 1.3 Create Deployment Scripts

**Create `ai/ai/deploy.sh`**:
```bash
#!/bin/bash

echo "🚀 Starting deployment..."

# Navigate to project root
cd "$(dirname "$0")"

# Build Frontend
echo "📦 Building frontend..."
cd ai/frontend
npm install
npm run build
cd ../..

# Install Backend Dependencies
echo "📦 Installing backend dependencies..."
cd ai/backend
pip install -r requirements.txt
cd ../..

echo "✅ Build complete!"
```

### Step 2: Connect to Hostinger VPS

1. **Get SSH credentials from Hostinger**:
   - Go to Hostinger hPanel
   - Navigate to VPS → SSH Access
   - Note your IP, username, and password

2. **Connect via SSH**:
   ```bash
   ssh username@your-server-ip
   ```

3. **Install Required Software**:
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Node.js 18+ (for Next.js)
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

   # Install Python 3.10+
   sudo apt install -y python3 python3-pip python3-venv

   # Install Nginx (web server)
   sudo apt install -y nginx

   # Install PM2 (process manager for Node.js)
   sudo npm install -g pm2

   # Install PostgreSQL (optional, for production database)
   sudo apt install -y postgresql postgresql-contrib
   ```

### Step 3: Upload Your Application

#### Option A: Using Git (Recommended)
```bash
# On your VPS
cd /var/www
sudo git clone https://github.com/yourusername/Huemn.git
# Or upload via SFTP/FTP
```

#### Option B: Using SFTP/FTP
1. Use FileZilla or similar FTP client
2. Connect to your VPS
3. Upload entire `ai` folder to `/var/www/huemn-ai/`

### Step 4: Set Up Backend

```bash
# Navigate to backend
cd /var/www/huemn-ai/ai/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy production environment file
cp .env.production .env
# Edit .env with your production values
nano .env

# Initialize database
python3 -c "from app.db.init_db import init_db; init_db()"
```

**Create PM2 ecosystem file** (`ai/ai/backend/ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'huemn-backend',
    script: 'run_backend.py',
    interpreter: 'python3',
    cwd: '/var/www/huemn-ai/ai/backend',
    env: {
      ENV: 'production',
      PORT: 8001,
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
  }]
};
```

**Start backend with PM2**:
```bash
cd /var/www/huemn-ai/ai/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable auto-start on boot
```

### Step 5: Set Up Frontend

```bash
# Navigate to frontend
cd /var/www/huemn-ai/ai/frontend

# Install dependencies
npm install

# Copy production environment file
cp .env.production .env.local

# Build for production
npm run build

# Start with PM2
pm2 start npm --name "huemn-frontend" -- start
pm2 save
```

### Step 6: Configure Nginx

Create Nginx configuration (`/etc/nginx/sites-available/huemn-ai`):
```nginx
# Frontend (Next.js)
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Backend API (FastAPI)
server {
    listen 80;
    server_name api.yourdomain.com;  # Or use yourdomain.com/api

    location / {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Enable the site**:
```bash
sudo ln -s /etc/nginx/sites-available/huemn-ai /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

### Step 7: Set Up SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Auto-renewal is set up automatically
```

---

## Option 2: Shared Hosting + External Backend

### Step 1: Deploy Backend to Railway/Render

#### Using Railway (Recommended):
1. Go to [railway.app](https://railway.app)
2. Create new project
3. Connect your GitHub repository
4. Add PostgreSQL database
5. Set environment variables:
   ```
   DATABASE_URL=<railway-postgres-url>
   SECRET_KEY=<your-secret-key>
   ENV=production
   ```
6. Deploy - Railway will auto-detect Python and deploy

#### Using Render:
1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Connect repository
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add PostgreSQL database
7. Set environment variables

### Step 2: Deploy Frontend to Hostinger Shared Hosting

1. **Build locally**:
   ```bash
   cd ai/frontend
   npm install
   npm run build
   ```

2. **Upload to Hostinger**:
   - Connect via FTP
   - Upload `.next` folder and `package.json` to `public_html/`
   - Upload `node_modules` (or install on server)

3. **Create `.htaccess`** in `public_html/`:
   ```apache
   RewriteEngine On
   RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]
   ```

4. **Or use Hostinger's Node.js App**:
   - In hPanel, go to Node.js App
   - Create new app
   - Point to your frontend folder
   - Set start command: `npm start`

---

## Domain Configuration

### In Hostinger hPanel:

1. **Go to Domains → Your Domain**
2. **DNS Settings**:
   - **A Record**: Point `@` to your VPS IP
   - **A Record**: Point `www` to your VPS IP
   - **A Record**: Point `api` to your VPS IP (if using subdomain)

3. **Wait for DNS propagation** (5 minutes to 48 hours)

---

## SSL/HTTPS Setup

### Automatic (Let's Encrypt):
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Manual (Hostinger SSL):
1. Go to hPanel → SSL
2. Install free SSL certificate
3. Enable "Force HTTPS Redirect"

---

## Post-Deployment Checklist

- [ ] Backend is running on port 8001
- [ ] Frontend is running on port 3000
- [ ] Nginx is configured and running
- [ ] SSL certificate is installed
- [ ] Domain is pointing to server
- [ ] Environment variables are set correctly
- [ ] Database is initialized
- [ ] PM2 processes are auto-starting
- [ ] Firewall allows ports 80, 443, 22
- [ ] Test all API endpoints
- [ ] Test frontend functionality
- [ ] Check error logs: `pm2 logs`

---

## Troubleshooting

### Backend not starting:
```bash
# Check logs
pm2 logs huemn-backend

# Check if port is in use
sudo netstat -tulpn | grep 8001

# Restart backend
pm2 restart huemn-backend
```

### Frontend not loading:
```bash
# Check logs
pm2 logs huemn-frontend

# Rebuild frontend
cd /var/www/huemn-ai/ai/frontend
npm run build
pm2 restart huemn-frontend
```

### Nginx errors:
```bash
# Check Nginx status
sudo systemctl status nginx

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Test configuration
sudo nginx -t
```

### Database issues:
```bash
# Check database file permissions
ls -la /var/www/huemn-ai/ai/backend/huemn.db

# Reinitialize database
cd /var/www/huemn-ai/ai/backend
python3 -c "from app.db.init_db import init_db; init_db()"
```

### CORS errors:
- Update `CORS_ORIGINS` in backend `.env` with your domain
- Check Nginx headers are forwarding correctly

### Port already in use:
```bash
# Find process using port
sudo lsof -i :8001
sudo lsof -i :3000

# Kill process if needed
sudo kill -9 <PID>
```

---

## Quick Commands Reference

```bash
# View all PM2 processes
pm2 list

# View logs
pm2 logs

# Restart all
pm2 restart all

# Stop all
pm2 stop all

# Check Nginx
sudo systemctl status nginx
sudo systemctl restart nginx

# Check server resources
htop
df -h
```

---

## Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Check system logs: `journalctl -xe`
4. Verify environment variables are set correctly
5. Ensure all ports are open in firewall

---

## Next Steps

After successful deployment:
1. Set up automated backups
2. Configure monitoring (PM2 Plus, UptimeRobot)
3. Set up CI/CD pipeline
4. Configure email notifications
5. Set up error tracking (Sentry)

---

**Good luck with your deployment! 🚀**

