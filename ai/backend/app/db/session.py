from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

is_postgres = settings.DATABASE_URL.startswith("postgresql")
connect_args = {"options": "-c client_encoding=UTF8"} if is_postgres else {}
engine_kwargs = {}
if is_postgres:
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_timeout": 30,
        "pool_recycle": 1800,
        "isolation_level": "READ COMMITTED",
    })

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args=connect_args,
    future=True,
    **engine_kwargs
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db():
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
