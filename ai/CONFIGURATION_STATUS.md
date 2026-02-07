# HUEMN.Ai Configuration Status

This document consolidates all configuration knobs, indicating what is required to configure and what is already configured by defaults or sample files. Use this as a checklist for local development, Docker, and Kubernetes.

## Locations
- Backend environment: .env (root or container env) — used by [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py)
- Frontend environment: ai/frontend/.env.local
- Docker Compose: [docker-compose.yml](file:///c:/Users/srava/huemn/docker-compose.yml)
- Kubernetes: [deploy/k8s/backend.yaml](file:///c:/Users/srava/huemn/deploy/k8s/backend.yaml), [deploy/k8s/frontend.yaml](file:///c:/Users/srava/huemn/deploy/k8s/frontend.yaml)
- Backend entry: [main.py](file:///c:/Users/srava/huemn/ai/backend/app/main.py)

## Backend (Required Minimum)
- ENV
  - Purpose: Environment mode
  - Required: Yes
  - Configured: Default is dev; example sets production
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L9)
- DATABASE_URL
  - Purpose: Database connection string
  - Required: Yes
  - Configured: Default sqlite:///./huemn.db in dev; production requires PostgreSQL
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L12-L18)
- SECRET_KEY
  - Purpose: Signing/encryption key
  - Required: Yes (production)
  - Configured: Default fixed dev secret; replace in production
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L24)
- REDIS_URL
  - Purpose: Cache, Celery broker/result
  - Required: Recommended
  - Configured: Default redis://localhost:6379
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L20-L21)
- CORS_ORIGINS
  - Purpose: Cross-origin settings
  - Required: Production recommended
  - Configured: Set in deployment docs; backend code permits wide-open in dev

## Backend (LLM and AI Providers)
- DEFAULT_LLM, LLM_MODE
  - Purpose: Provider selection and mode
  - Required: Optional
  - Configured: Defaults to openai and hybrid
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L26-L34)
- OPENAI_API_KEY, OPENAI_MODEL
  - Purpose: Provider credentials (legacy; now UI-driven)
  - Required: Optional (needed for real AI responses)
  - Configured: Provided via env or UI; defaults are placeholders
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L30-L34)
- Azure/Claude/Gemini fields
  - Purpose: Alternate provider credentials
  - Required: Optional
  - Configured: Set via env/UI if used
  - Reference: [llm](file:///c:/Users/srava/huemn/ai/backend/app/llm)

## Backend (Connectors)
- Jira: JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN
- Zendesk: ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_TOKEN
- Salesforce: SALESFORCE_USERNAME, SALESFORCE_PASSWORD, SALESFORCE_SECURITY_TOKEN
- Greenhouse: GREENHOUSE_API_KEY
- LinkedIn: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_ACCESS_TOKEN
- USE_REAL_CONNECTORS
  - Purpose: Toggle between mock and real connectors
  - Required: Optional; set to 1 for real integrations
  - Configured: Default 0 (mock)
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L68-L70)

## Backend (Email and Telephony)
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_FROM_NAME, SMTP_USE_TLS
  - Required: Optional (for email features)
  - Configured: Defaults present; credentials not set
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L79-L87)
- Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_APP_SID
  - Required: Optional (for voice)
  - Configured: Not set by default
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L88-L95)
- Voice/STT: HUEMN_VOICE_API_KEY, DEEPGRAM_API_KEY
  - Required: Optional
  - Configured: Not set by default
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L97-L100)

## Backend (Runtime and Ops)
- ADMIN_API_KEY
  - Purpose: Protect admin endpoints
  - Required: Optional; recommended in production
  - Configured: Not set by default
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L65-L67)
- BYPASS_SUBSCRIPTION
  - Purpose: Dev-only bypass for subscription checks
  - Required: Optional; set to 0 in production
  - Configured: Default 1 (enabled)
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L74-L78)
- API_BASE_URL
  - Purpose: Base URL for webhooks
  - Required: Optional; adjust in production
  - Configured: Default http://localhost:8000
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L95)
- Celery: CELERY_BROKER_URL, CELERY_RESULT_BACKEND
  - Purpose: Task queue
  - Required: Optional; defaults derive from REDIS_URL
  - Configured: Default redis://localhost:6379
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L106-L109)
- Storage: STORAGE_PROVIDER, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION
  - Required: Optional
  - Configured: Default local provider; S3 unset
  - Reference: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py#L110-L116)

## Frontend
- NEXT_PUBLIC_API_BASE
  - Purpose: Backend API base URL
  - Required: Yes
  - Configured: Defaults to http://127.0.0.1:8001 in local dev docs; Docker uses http://localhost/api; K8s uses backend service URL
  - Locations:
    - Local dev: ai/frontend/.env.local (see [CONFIGURATION_GUIDE.md](file:///c:/Users/srava/huemn/ai/CONFIGURATION_GUIDE.md#L1-L30))
    - Docker Compose: [docker-compose.yml](file:///c:/Users/srava/huemn/docker-compose.yml#L27-L36)
    - Kubernetes: [frontend.yaml](file:///c:/Users/srava/huemn/deploy/k8s/frontend.yaml#L17-L21)

## Docker Compose
- Backend
  - ENV=production (container env)
  - DATABASE_URL from .env (external)
  - Exposes 8000 internally to Nginx
  - Reference: [docker-compose.yml](file:///c:/Users/srava/huemn/docker-compose.yml#L12-L32)
- Frontend
  - NEXT_PUBLIC_API_BASE passed via build args and environment
  - API_INTERNAL_URL=http://backend:8000 for SSR inside Compose
  - Reference: [docker-compose.yml](file:///c:/Users/srava/huemn/docker-compose.yml#L33-L53)
- Nginx
  - Proxies 80/443 to frontend/backend
  - Reference: [docker-compose.yml](file:///c:/Users/srava/huemn/docker-compose.yml#L3-L11)

## Kubernetes
- Backend
  - ENV=production (hard-coded)
  - DATABASE_URL, REDIS_URL from secrets (required)
  - Port 8000 service
  - Reference: [backend.yaml](file:///c:/Users/srava/huemn/deploy/k8s/backend.yaml)
- Frontend
  - NEXT_PUBLIC_API_BASE set to backend service URL
  - Port 3000 service
  - Reference: [frontend.yaml](file:///c:/Users/srava/huemn/deploy/k8s/frontend.yaml)

## Defaults vs Required (Summary)
- Dev mode works out-of-the-box with defaults:
  - ENV=dev, SQLite, Redis local, open CORS, bypass subscription
- Production requires explicit configuration:
  - ENV=production or prod
  - PostgreSQL DATABASE_URL (SQLite disallowed)
  - SECRET_KEY set to a strong value
  - CORS_ORIGINS restricted
  - NEXT_PUBLIC_API_BASE pointing to public API domain
  - Optional: provider and connector credentials

## Verification
- Backend health: http://127.0.0.1:8001/health
- Database health: http://127.0.0.1:8001/api/status/db (added)
  - Reference: [status.py](file:///c:/Users/srava/huemn/ai/backend/app/api/status.py#L81-L89)
- Frontend connectivity: open http://localhost:3000 and check console for errors
- Alembic migrations: run with DATABASE_URL pointing to PostgreSQL

## Example Environment (Production)
```
ENV=production
POSTGRES_USER=huemn_prod
POSTGRES_PASSWORD=change_me_strong_password
POSTGRES_DB=huemn
POSTGRES_PORT=5432
DATABASE_URL=postgresql+psycopg2://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}
REDIS_URL=redis://localhost:6379
SECRET_KEY=replace_with_strong_secret_key
NEXT_PUBLIC_API_BASE=https://yourdomain.com/api
```

## Notes
- Production startup checks reject SQLite and verify DB connectivity during app lifecycle
  - Reference: [lifecycle.py](file:///c:/Users/srava/huemn/ai/backend/app/core/lifecycle.py#L18-L25), [session.py](file:///c:/Users/srava/huemn/ai/backend/app/db/session.py#L19-L31)
