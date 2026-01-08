#!/bin/bash

# HUEMN.Ai Deployment Script
# This script prepares your application for deployment

set -e  # Exit on error

echo "🚀 HUEMN.Ai Deployment Preparation"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "ai" ]; then
    echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Step 1: Installing Frontend Dependencies...${NC}"
cd ai/frontend
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "  ✓ node_modules already exists, skipping..."
fi

echo -e "${YELLOW}📦 Step 2: Installing Backend Dependencies...${NC}"
cd ../backend
if [ ! -d "venv" ]; then
    echo "  Creating Python virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt

echo -e "${YELLOW}🔨 Step 3: Building Frontend...${NC}"
cd ../frontend
npm run build

echo -e "${GREEN}✅ Build Complete!${NC}"
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo "1. Upload the entire 'ai' folder to your server"
echo "2. Follow the deployment guide: DEPLOYMENT_GUIDE_HOSTINGER.md"
echo "3. Set up environment variables on your server"
echo "4. Configure Nginx and SSL"
echo ""
echo -e "${YELLOW}⚠️  Don't forget to:${NC}"
echo "  - Update .env files with production values"
echo "  - Set SECRET_KEY to a secure random string"
echo "  - Update CORS_ORIGINS with your domain"
echo "  - Configure database (SQLite or PostgreSQL)"

