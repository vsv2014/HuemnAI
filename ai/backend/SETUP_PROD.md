Production Setup (quick)

1. Set environment variables (example):
   - DATABASE_URL=postgresql+psycopg2://user:pass@postgres:5432/huemn
   - REDIS_URL=redis://redis:6379/0
   - SENTRY_DSN=
   - STORAGE_PROVIDER=s3
   - S3_BUCKET=your-bucket

2. Run services via Docker Compose:
   docker-compose -f docker-compose.yml up -d --build

3. Create initial Alembic migration and apply:
   cd ai/backend
   alembic revision --autogenerate -m "initial"
   alembic upgrade head

4. Start Celery worker (if not using compose):
   celery -A app.core.celery_app.celery_app worker --loglevel=info

Notes:
- In production, do not use auto schema creation. Use Alembic migrations instead.
- Configure Sentry DSN to capture exceptions and traces.
- Ensure S3 credentials are set if using object storage.
