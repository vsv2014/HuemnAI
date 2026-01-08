# HUMANE.OS — Complete Setup & Deployment Guide

## Overview
This is a full-stack AI assistant application with a Next.js frontend and FastAPI backend. The frontend uses 3D-animated product tiles, real-time SSE streaming, and product-specific demos. The backend provides chat, actions, products, and status endpoints.

---

## Project Structure

```
ai/
├── .venv/                    # Python virtual environment
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI app entry point
│   │   ├── api/
│   │   │   ├── chat.py       # Chat streaming endpoint
│   │   │   ├── actions.py    # Action execution endpoint
│   │   │   ├── feedback.py   # Feedback endpoint
│   │   │   ├── status.py     # Status endpoint
│   │   │   └── products.py   # Products list & detail endpoints
│   │   ├── services/         # Business logic (LLM, memory, etc.)
│   │   ├── db/               # Database models
│   │   ├── core/             # Config, logging, security
│   │   └── llm/              # LLM integrations
│   └── requirements.txt
│
└── frontend/
    ├── app/
    │   ├── layout.tsx        # Root layout
    │   ├── page.tsx          # Home page
    │   ├── chat/
    │   │   └── page.tsx      # Chat interface
    │   └── products/
    │       └── [slug]/
    │           └── page.tsx  # Product detail page
    ├── components/
    │   ├── Hero.tsx                    # Hero with animated head
    │   ├── AnimatedHead.tsx            # Lottie-based animation
    │   ├── ProductGrid.tsx             # Product grid layout
    │   ├── ProductCard.tsx             # 3D tilt product tiles
    │   ├── ProductDemo.tsx             # Mini chat demo widget
    │   ├── ChatWindow.tsx              # Chat UI component
    │   └── ...other components
    ├── public/
    │   └── animations/
    │       └── head.json               # Lottie animation
    ├── styles/
    │   └── globals.css                 # Global styles (3D tiles)
    ├── .env.local                      # Local env vars
    ├── package.json
    └── tailwind.config.js
```

---

## Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.8+ (for backend)
- **npm** or **yarn** (frontend package manager)

---

## Quick Start

### 1. Backend Setup

```bash
# Navigate to backend directory
cd ai/backend

# Create and activate virtual environment (if not already done)
python -m venv ../.venv
# On PowerShell:
& ..\.venv\Scripts\Activate.ps1
# On Bash/Linux/Mac:
source ../.venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

**Expected output:**
```
INFO:     Started server process [XXXX]
INFO:     Uvicorn running on http://127.0.0.1:8001
```

### 2. Frontend Setup

In a new terminal:

```bash
# Navigate to frontend directory
cd ai/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

**Expected output:**
```
✓ Starting Next.js 15.5.9
- Local: http://localhost:3000
```

### 3. Open in Browser

- Frontend: **http://localhost:3000**
- Backend API: **http://127.0.0.1:8001**
- Health check: **http://127.0.0.1:8001/health**

---

## Key Features

### Frontend

#### 3D Floating Product Tiles
- Smooth parallax tilt (using `react-parallax-tilt`)
- Floating animation with color gradients
- Hover glows and depth effects
- Click to navigate to product detail page

#### Animated Head (Hero)
- Lottie animation from `public/animations/head.json`
- Falls back to SVG if Lottie JSON not found
- Rotating, color-shifting animation

#### Product Detail Pages (`/products/[slug]`)
- Full product information
- Features section
- Embedded ProductDemo chat widget
- Quick-demo CTA buttons

#### Interactive ProductDemo Widget
- Product-specific demo prompts
- Real-time SSE streaming from backend
- Quick-prompt buttons (e.g., "What are the main features?")
- Emoji indicators (👤 for user, 🤖 for assistant)
- Connection status (🟢 connected / 🔴 disconnected)

#### Chat Page (`/chat`)
- Full SSE streaming chat interface
- Token aggregation into cohesive messages
- Auto-scroll to latest message
- Fallback to fetch+ReadableStream if EventSource blocked
- Product query parameter support

#### Status Widget System
- **Embeddable Widget** - Appears in header when logged in
- **9 Status Types** - Online, Busy, Away, Lunch, Break, Meeting, Training, On Leave, Offline
- **Subscribed Tools Display** - Shows all active integrations
- **Work Time Tracking** - Automatically tracks employee work hours
- **Third-Party Integration** - Can be embedded in Zendesk, Jira, etc.
- See `STATUS_WIDGET_SYSTEM.md` for detailed documentation

#### Analytics Dashboard
- **Comprehensive Metrics** - Ticket solving rate, pending rate, backlog, inflow
- **SLA Tracking** - SLA breached, satisfied, pending with satisfaction rates
- **Team Workload** - L1/L2 team pending tickets, escalated count
- **Work Time Analytics** - Employee work time tracking with visualizations
- **Futuristic UI** - Animated charts, glowing effects, mechanical animations
- **Multiple Chart Types** - Area, Bar, Pie, Radial charts for different metrics
- See `ANALYTICS_DASHBOARD.md` for detailed documentation

### Backend

#### Endpoints

- **`GET /`** — Root API info
- **`GET /health`** — Health check
- **`GET /api/chat/stream?message=<message>`** — SSE chat streaming
- **`POST /api/actions/`** — Execute actions (used on product click)
- **`POST /api/feedback/`** — Send feedback
- **`POST /api/status/`** — Update user status (supports 9 status types)
- **`GET /api/status/{user_id}`** — Get user status details
- **`GET /api/products/`** — List all products
- **`GET /api/products/{slug}`** — Get product details
- **`GET /api/analytics/overview`** — Get comprehensive analytics data
- **`GET /api/analytics/trends?days=30`** — Get trend data
- **`GET /api/widget/subscribed-tools`** — Get user's subscribed tools
- **`GET /api/widget/embed.js`** — Get widget embed script
- **`POST /api/auth/signup`** — User signup with free trial
- **`POST /api/auth/login`** — User login
- **`GET /api/auth/me`** — Get current user info
- **`GET /api/subscription/plans`** — Get subscription plans
- **`POST /api/subscription/subscribe`** — Subscribe to a plan
- **`GET /api/subscription/status`** — Get subscription status
- **`POST /api/demo-request`** — Submit demo request

#### CORS
Backend allows cross-origin requests:
```python
allow_origins=['*']
allow_credentials=True
allow_methods=['*']
allow_headers=['*']
```

---

## Configuration

### Environment Variables

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001
```

Change this if:
- Backend is on a different port/host
- Using a tunnel (e.g., `https://c1.devtunnels.ms`)

### Backend Configuration

Edit `backend/app/core/config.py` for:
- LLM settings (Azure OpenAI, OpenAI)
- Database connection
- Logging levels
- API timeouts

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 8001
netstat -aon | findstr :8001

# Kill process (replace XXXX with PID)
taskkill /PID XXXX /F
```

### EPERM Error (File Permission)

If you see `.next` permission errors:

```bash
cd frontend
Remove-Item -Force -Recurse .next
npm run dev
```

### Frontend Can't Connect to Backend

1. **Check backend is running:**
   ```bash
   Invoke-WebRequest -Uri 'http://127.0.0.1:8001/health'
   ```

2. **Update `frontend/.env.local`:**
   ```env
   NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001
   ```

3. **Restart frontend:**
   ```bash
   npm run dev
   ```

### SSE Connection Issues

- If EventSource fails (tunnel/proxy blocks it), the frontend automatically falls back to fetch+ReadableStream.
- Check browser console for detailed error messages.

---

## Development Workflow

### Adding New Features

1. **Backend:** Add endpoint in `backend/app/api/`
2. **Frontend:** Create component in `frontend/components/`
3. **API Integration:** Use `NEXT_PUBLIC_API_BASE` environment variable
4. **Testing:** Use the ProductDemo widget or the full chat page

### Hot Reload

- **Backend:** Uvicorn auto-reloads on file changes (if `--reload` enabled)
- **Frontend:** Next.js hot-reloads on file changes

---

## Deployment

### Docker (Optional)

See `backend/Dockerfile/` for backend container setup.

### Frontend Deployment

```bash
npm run build
npm run start
```

Deploy to Vercel, Netlify, or any Node.js hosting.

### Backend Deployment

Use uvicorn with a production ASGI server:

```bash
gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker
```

Or use Docker as shown in the Dockerfile.

---

## API Examples

### Chat Streaming

```bash
curl -N "http://127.0.0.1:8001/api/chat/stream?message=Hello%20world"
```

### List Products

```bash
curl "http://127.0.0.1:8001/api/products/"
```

### Product Detail

```bash
curl "http://127.0.0.1:8001/api/products/support-ai"
```

### Notify Action

```bash
curl -X POST "http://127.0.0.1:8001/api/actions/" \
  -H "Content-Type: application/json" \
  -d '{"action": {"name": "Support AI"}}'
```

---

## Architecture Highlights

- **Frontend**: Next.js 15 with React 18, Tailwind CSS, Parallax Tilt, Lottie
- **Backend**: FastAPI with async/await, SSE streaming, CORS enabled
- **Styling**: 3D CSS transforms, hover glows, animated gradients
- **Real-Time**: Server-Sent Events (SSE) with fallback to fetch streaming
- **State Management**: React hooks (no Redux needed)

---

## New Features (Latest)

### Status Widget System
- Embeddable widget for status updates
- 9 status types (Online, Busy, Away, Lunch, Break, Meeting, Training, On Leave, Offline)
- Work time tracking for all statuses
- Can be embedded in third-party tools
- See `STATUS_WIDGET_SYSTEM.md` for details

### Analytics Dashboard
- Comprehensive ticket analytics
- SLA metrics and performance tracking
- Employee work time analytics
- Futuristic animated visualizations
- See `ANALYTICS_DASHBOARD.md` for details

### Subscription System
- Free trial (14 days, one per IP)
- Tiered pricing (Basic, Professional, Enterprise)
- 50% discount on first subscription
- Integration badges in header
- See `SUBSCRIPTION_SYSTEM.md` for details

### Demo Request System
- Demo request form with tool selection
- Email notifications with glowing logo template
- Thank you page with animations
- See demo request flow in `/demo-request`

## Important Notes

### Database Reset
⚠️ **Development Mode**: When new database models are added, the database is recreated (all tables dropped and recreated). This means:
- All user accounts are deleted
- All data is reset
- Users need to sign up again

**Solution for Production**: Use database migrations (Alembic) instead of dropping/recreating tables.

### Authentication
- Users must sign up to access features
- Free trial is available (14 days)
- One trial per IP address (unless `BYPASS_SUBSCRIPTION=1`)

## Next Steps

1. **Wire up LLM:** Connect to Azure OpenAI or OpenAI in `backend/app/llm/`
2. **Add Database:** Implement conversation history storage in `backend/app/db/`
3. **Enhance Demos:** Add product-specific response templates
4. **Styling:** Further customize gradients, colors, animations in `globals.css`
5. **Mobile Optimization:** Add responsive breakpoints for smaller screens
6. **Database Migrations:** Implement Alembic for production database management

---

## Support

For issues or feature requests, check the browser console and backend logs:

```bash
# Backend logs (look for error details)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Browser DevTools → Console for frontend errors.

---

## License

Proprietary. All rights reserved.
#   H u e m n  
 