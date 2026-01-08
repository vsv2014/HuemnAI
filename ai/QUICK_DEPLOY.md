# ⚡ Quick Deployment Guide - Hostinger

## 🎯 Fastest Path to Production

### Prerequisites Checklist
- [ ] Hostinger VPS or Shared Hosting account
- [ ] Domain name configured
- [ ] SSH access (for VPS)

---

## 🚀 Quick Start (5 Steps)

### Step 1: Prepare Locally
```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment preparation
./deploy.sh
```

### Step 2: Upload to Server
```bash
# Using SFTP/SCP
scp -r ai username@your-server-ip:/var/www/humane-os/

# Or use FileZilla/FTP client
# Upload entire 'ai' folder to /var/www/humane-os/
```

### Step 3: SSH into Server
```bash
ssh username@your-server-ip
```

### Step 4: Install Dependencies on Server
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python
sudo apt install -y python3 python3-pip python3-venv

# Install Nginx
sudo apt install -y nginx

# Install PM2
sudo npm install -g pm2
```

### Step 5: Deploy Application
```bash
# Navigate to project
cd /var/www/humane-os/ai

# Setup Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.production .env  # Edit with your values
nano .env  # Set SECRET_KEY, CORS_ORIGINS, etc.
pm2 start ecosystem.config.js
pm2 save

# Setup Frontend
cd ../frontend
npm install
cp .env.production .env.local  # Edit with your API URL
nano .env.local  # Set NEXT_PUBLIC_API_BASE
npm run build
pm2 start npm --name "humane-frontend" -- start
pm2 save

# Setup Nginx
sudo cp ../../nginx.conf.example /etc/nginx/sites-available/humane-os
sudo nano /etc/nginx/sites-available/humane-os  # Update domain names
sudo ln -s /etc/nginx/sites-available/humane-os /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 📝 Environment Variables

### Backend (.env)
```env
ENV=production
SECRET_KEY=your-random-secret-key-here
DATABASE_URL=sqlite:///./humane.db
BACKEND_PORT=8001
BACKEND_HOST=0.0.0.0
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_BASE=https://api.yourdomain.com
# Or if using same domain:
# NEXT_PUBLIC_API_BASE=https://yourdomain.com/api
```

---

## ✅ Verify Deployment

1. **Check PM2 processes**:
   ```bash
   pm2 list
   pm2 logs
   ```

2. **Test endpoints**:
   - Frontend: `https://yourdomain.com`
   - Backend: `https://api.yourdomain.com/health`

3. **Check Nginx**:
   ```bash
   sudo systemctl status nginx
   sudo tail -f /var/log/nginx/error.log
   ```

---

## 🔧 Common Issues

### Port already in use
```bash
sudo lsof -i :8001
sudo kill -9 <PID>
```

### PM2 not starting on boot
```bash
pm2 startup
# Follow the instructions shown
```

### Nginx 502 Bad Gateway
- Check if backend is running: `pm2 list`
- Check backend logs: `pm2 logs humane-backend`
- Verify port 8001 is accessible: `curl http://localhost:8001/health`

---

## 📚 Full Documentation

See `DEPLOYMENT_GUIDE_HOSTINGER.md` for detailed instructions.

---

**Need Help?** Check the troubleshooting section in the full deployment guide.

