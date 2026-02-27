# ABOUT THE HUEMN.Ai PROJECT

This document provides a comprehensive, deep-dive explanation of the HUEMN.Ai codebase. It covers the architecture, the role of every key file, and the functionality of critical components.

---

## 1. High-Level Architecture

HUEMN.Ai is an Enterprise AI platform designed for automated business workflows, AI agent management, and real-time interactions.

### **Core Stack**
- **Backend:** FastAPI (Python 3.11+) - High-performance asynchronous API.
- **Frontend:** Next.js (React 15+) - Modern web framework with Server-Side Rendering (SSR).
- **Database:** PostgreSQL (Production) / SQLite (Development) with SQLAlchemy ORM.
- **Task Queue:** Celery + Redis for background processing (crawling, indexing).
- **Real-time:** WebSockets for voice streaming, live transcripts, and status updates.
- **AI/LLM:** Multi-provider support (OpenAI, Azure, Anthropic, Gemini) via a custom registry.
- **Voice:** Twilio (Telephony), ElevenLabs/HuemnVoice (TTS), Deepgram (STT).

---

## 2. Backend Breakdown (`ai/backend/app`)

The backend follows a modular service-oriented architecture.

### **API Layer (`/api`)**
Defines the REST and WebSocket endpoints.

- **main.py**: The application entry point. 
  - *Key Tasks:* Initializes FastAPI, configures CORS, mounts static files, and includes all sub-routers.
- **auth.py**: User authentication and session management.
  - `create_jwt_token(user)`: Generates long-lived JWTs.
  - `get_current_user(...)`: Dependency for protecting routes.
  - *Features:* Email/Password login, Google OAuth, and OTP verification.
- **agents.py**: Core logic for the AI Agent Builder.
  - `process_message(...)`: Primary endpoint for interacting with an agent.
  - `build_node_code(node)`: Serializes flow nodes for the execution engine.
  - *Features:* CRUD for agents, nodes, and connections; template-based agent creation.
- **voice_ws.py**: Real-time binary WebSocket for Text-to-Speech.
  - `voice_stream_ws(websocket)`: Streams audio chunks from local or remote TTS engines.
- **knowledge.py**: RAG (Retrieval-Augmented Generation) management.
  - *Features:* Uploading documents, managing knowledge sources, and querying the knowledge base.
- **subscription.py**: Monetization and access control.
  - *Features:* Stripe/Razorpay integration, plan management, and trial tracking.

### **Core Layer (`/core`)**
Global settings and infrastructure.

- **config.py**: Centralized configuration using Pydantic Settings. Manages all API keys and environment variables.
- **security.py**: Security utilities like password hashing and token validation.
- **redis.py**: Initializes the Redis client for caching and Celery.

### **Database Layer (`/db`)**
Persistence logic and schema definitions.

- **session.py**: Manages database connections and session life cycles.
- **Models (`/models`)**:
  - **user.py**: User profiles, roles, and account state.
  - **agent.py**: Agent metadata, flow nodes, connections, and message history.
  - **knowledge.py**: Knowledge sources, crawled content, and embeddings.

### **Service Layer (`/services`)**
Exhaustive business logic implementation.

- **agent_executor.py**: The "brain" that runs agent flows.
  - `AgentExecutor.execute(...)`: Processes an agent's logic node-by-node.
  - `AgentExecutor._execute_node(...)`: Handles specific node types (LLM, API, Condition, etc.).
- **llm_service.py**: High-level wrapper for AI interactions.
  - `LLMService.get_response(...)`: Fetches completion from the configured LLM provider.
- **knowledge_service.py**: Logic for the Knowledge AI.
  - `query_with_solution(...)`: Performs semantic search and generates a solution using LLM context.
  - `index_all_connectors()`: Synchronizes data from Jira, Zendesk, and Salesforce.
- **huemn_voice_service.py**: Interface for TTS.
  - *Features:* Support for ElevenLabs and local XTTS models.
- **telephony_service.py**: Twilio integration for inbound and outbound calls.

---

## 3. Frontend Breakdown (`ai/frontend`)

Built with Next.js App Router and Zustand.

### **App Pages (`/app`)**
- **page.tsx**: Main landing page with service overviews.
- **agents/page.tsx**: Dashboard for managing AI agents.
- **agents/[id]/page.tsx**: The visual flow builder for a specific agent.
- **customer-service/agent-console/page.tsx**: Real-time interface for agents to handle calls and chats.
- **auth/login/page.tsx**: User authentication entry.

### **Components (`/components`)**
- **Rotating3DLogo.tsx**: Hardened 3D visual component for the main branding.
- **EnhancedKnowledgeAI.tsx**: The primary interface for interacting with the knowledge base.
- **ToolSwitcher.tsx**: Navigation menu to jump between HR, CRM, and Voice tools.
- **ConnectorConfig.tsx**: UI for setting up third-party integrations (Jira, Slack, etc.).

### **Services and State (`/services`, `/store`)**
- **api.ts**: A centralized fetch wrapper.
  - `safeFetch(url, options)`: Handles timeouts, base URLs, and automatic redirection to pricing on 403 errors.
- **authStore.ts**: Zustand store for managing `token`, `user`, and `subscriptionStatus`.

---

## 4. How to Run the Project

1. **Backend API:**
   ```bash
   cd ai/backend
   python -m uvicorn app.main:app --port 8001 --reload
   ```
2. **Frontend App:**
   ```bash
   cd ai/frontend
   npm run dev
   ```
3. **Redis:** Ensure Redis is running on port 6379.
4. **Celery Worker (Optional):**
   ```bash
   cd ai/backend
   celery -A app.core.celery_app.celery_app worker --loglevel=info
   ```

---

## 5. AI Context Prompt

Copy this prompt to give another AI a full understanding of this project:

> \"I am working on **HUEMN.Ai**, an Enterprise AI platform.
>
> **Stack:** FastAPI (Backend), Next.js (Frontend), PostgreSQL, Redis, Celery.
> **Backend Architecture:** Modular `app/` directory. `api/` handles routes (like `agents.py` for flows), `services/` contains logic (like `agent_executor.py` for running nodes), and `db/models/` defines schema (like `agent.py`).
> **Frontend Architecture:** Next.js App Router. `services/api.ts` is the central API client. Zustand manages state in `store/`.
> **Key Logic:** The `AgentExecutor` service runs visual flows node-by-node. The `knowledge_service.py` handles RAG logic by indexing external connectors.
>
> Please use this to help me with debugging or adding features. Reference file names directly.\"

---
