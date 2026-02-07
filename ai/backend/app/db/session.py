from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

is_postgres = settings.DATABASE_URL.startswith("postgresql")
connect_args = {"options": "-c client_encoding=UTF8"} if is_postgres else {}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10 if is_postgres else None,
    max_overflow=20 if is_postgres else None,
    pool_timeout=30 if is_postgres else None,
    pool_recycle=1800 if is_postgres else None,
    isolation_level="READ COMMITTED" if is_postgres else None,
    connect_args=connect_args,
    future=True
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def ping_database():
    with engine.connect() as conn:
        if settings.IS_PROD and not is_postgres:
            raise RuntimeError("Production requires PostgreSQL")
        conn.execute(text("SELECT 1"))
        if is_postgres:
            conn.execute(text("SHOW server_encoding"))
