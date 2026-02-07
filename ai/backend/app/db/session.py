from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

is_postgres = settings.DATABASE_URL.startswith("postgresql")

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10 if is_postgres else None,
    max_overflow=20 if is_postgres else None,
    pool_timeout=30 if is_postgres else None,
    pool_recycle=1800 if is_postgres else None,
    isolation_level="READ COMMITTED" if is_postgres else None,
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
