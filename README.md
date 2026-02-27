# Huemn — AI Operations Platform

## Overview
Huemn is a full-stack AI operations platform with a Next.js frontend and a FastAPI backend. It unifies AI agent building, orchestration workflows, CRM tooling, customer service, knowledge search, ticketing, voice, analytics, and subscriptions into one product.

## What This Project Includes
- AI agent builder with visual flow editing and node orchestration.
- AI Orchestrator for multi-step workflows and tool execution.
- Customer service and ticketing tools with connectors.
- Knowledge AI for searchable SOPs and documents.
- HR services and hiring workflows.
- CRM workspace with contacts, pipeline, and copilots.
- Voice and IVR capabilities with WebSockets.
- Analytics dashboards, status widget, and work-time tracking.
- Subscription system with trials and access enforcement.

## Tech Stack
- Frontend: Next.js 15, React 18, Tailwind CSS, React Flow, Monaco Editor
- Backend: FastAPI, async services, SSE streaming, WebSocket support
- Data: SQL models in `ai/backend/app/db`
- Integrations: CRM, ticketing, voice, connectors, external APIs

## Project Structure
```
ai/
├── backend/                   FastAPI app, APIs, services, DB models
├── frontend/                  Next.js app and UI components
├── docs & guides              Architecture and feature docs
├── start_servers.bat          Windows starter with dependency checks
├── start_servers.ps1          PowerShell starter with dependency checks
├── check_dependencies.bat     Windows dependency check
└── run_backend.py             Backend launcher
```

## Requirements
### Required
- Node.js 18+
- Python 3.8+
- npm

### Optional (for advanced features)
- Redis (for background tasks and caching)
- OpenAI, Azure OpenAI, Anthropic, Google Gemini, or Ollama for LLM responses
- Twilio for voice and telephony
- SMTP credentials for email sending
- Connector credentials for CRM, ticketing, HR, and collaboration tools

## Installation & Setup

To get HUEMN.Ai running locally, follow these steps in order.

### 1. Backend Setup
1. **Create Virtual Environment:**
   ```bash
   cd ai/backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```
2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Configure Environment:**
   Create a `.env` file in `ai/backend/` (refer to `app/core/config.py` for required keys).

### 2. Frontend Setup
1. **Install Dependencies:**
   ```bash
   cd ai/frontend
   npm install
   ```
2. **Configure Environment:**
   Create a `.env.local` file in `ai/frontend/`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8001
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
   ```

## Running the Servers

For the full application to work, you need to run the following servers in separate terminals:

### 1. API Server (Mandatory)
Handles all core logic, authentication, and data management.
```bash
cd ai/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend Development Server (Mandatory)
The web interface for users and admins.
```bash
cd ai/frontend
npm run dev
```

### 3. Redis Server (Highly Recommended)
Used for caching, real-time status updates, and task queuing.
- **Windows:** Use WSL2 or download Redis for Windows.
- **Linux/Mac:** `brew install redis` or `sudo apt install redis`.

### 4. Celery Worker (Optional - For Background Tasks)
Required for long-running tasks like web crawling and document indexing.
```bash
cd ai/backend
celery -A app.core.celery_app.celery_app worker --loglevel=info
```

## Accessing the App
- **Web Interface:** [http://localhost:3000](http://localhost:3000)
- **API Documentation (Swagger):** [http://localhost:8001/docs](http://localhost:8001/docs)
- **Backend Health Check:** [http://localhost:8001/health](http://localhost:8001/health)

---

For a deep dive into the project's architecture and file-by-file breakdown, please refer to [ABOUT_PROJECT.md](file:///c:/Users/srava/huemn/ABOUT_PROJECT.md).

### Backend
`ai/backend/.env`
```env
ENV=dev
DATABASE_URL=sqlite:///./huemn.db
BACKEND_PORT=8001
DEFAULT_LLM=openai
BYPASS_SUBSCRIPTION=1
```

Optional backend settings are supported for LLMs, connectors, email, and telephony. For full options, see:
- ai/CONFIGURATION_GUIDE.md
- ai/FEATURES_OVERVIEW.md
- ai/PRODUCT_DOCUMENTATION.md

## Main Areas in the App
- Home: `/`
- Agent Builder: `/agents` and `/agents/[id]`
- AI Orchestrator: `/agent-builder`
- Chat Tools: `/chat/[tool]`
- Customer Service Console: `/customer-service/agent-console`
- CRM: `/crm`
- Knowledge: `/knowledge`
- HR: `/hr`
- Voice Studio: `/voice`
- Marketplace: `/marketplace`
- Pricing and Subscriptions: `/pricing`
- Admin Governance: `/admin/registry`
- Settings and Integrations: `/settings`
- Authentication: `/auth/*`

## Tools and Modules Available
### AI Tools
- Customer Service
- Ticket Assigner
- Ticket Solver
- Knowledge AI
- HR Services
- Status Updater
- Analytics Dashboard

### Agent & Orchestration
- Visual agent flow builder
- Import and export of orchestrator sessions
- Tool configuration and connector setup

### CRM and Operations
- Contact management
- Pipeline management
- Activity timeline and copilot chat

### Analytics
- Ticket metrics, SLA tracking, and workload analytics
- Status widget with work-time tracking

### Voice
- Voice workflows and IVR integration
- WebSocket streaming for real-time updates

## Backend API Overview
The backend exposes a large set of APIs, including:
- Chat, actions, feedback, and status management
- Knowledge and knowledge sources
- Tickets, routing, analytics, and conversations
- Agents, agent templates, and workflows
- CRM, HR, tools, and connector configuration

Full endpoints and schemas are available at:
http://127.0.0.1:8001/docs

## How to Use (End-to-End)
1. Start backend and frontend servers.
2. Open the frontend at http://localhost:3000.
3. Sign up and log in.
4. Go to Settings and configure an LLM provider if you want real AI responses.
5. Open Agent Builder and create an agent or use an existing template.
6. Use Chat Tools for Customer Service, HR, Ticketing, or Knowledge AI.
7. Configure connectors for Jira, Zendesk, Salesforce, Slack, and others when needed.
8. Use Analytics to monitor performance and team workload.
9. Use CRM and Marketplace for operational workflows.

## Troubleshooting
### Port in Use
```bash
netstat -aon | findstr :8001
taskkill /PID <PID> /F
```

### Frontend Cannot Reach Backend
```bash
Invoke-WebRequest -Uri "http://127.0.0.1:8001/health"
```
If the health check fails, restart the backend and confirm `NEXT_PUBLIC_API_BASE`.

### Database Reset in Development
In development, database models can be recreated when they change. This resets data and user accounts. Use migrations for production.

## Documentation Map
- ai/SETUP_GUIDE.md
- ai/START_SERVERS.md
- ai/FEATURES_OVERVIEW.md
- ai/CONFIGURATION_GUIDE.md
- ai/PRODUCT_DOCUMENTATION.md
- ai/ARCHITECTURE.md
- ai/DEPLOYMENT_GUIDE_HOSTINGER.md

## License
Proprietary. All rights reserved.
