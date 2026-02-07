import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import Base
from app.core.config import settings

SQLITE_URL = os.getenv("SQLITE_URL", "sqlite:///./huemn.db")
POSTGRES_URL = os.getenv("POSTGRES_URL", settings.DATABASE_URL)

src_engine = create_engine(SQLITE_URL)
dst_engine = create_engine(POSTGRES_URL)

SrcSession = sessionmaker(bind=src_engine, autoflush=False, autocommit=False)
DstSession = sessionmaker(bind=dst_engine, autoflush=False, autocommit=False)

def copy_table(mapper):
    cls = mapper.class_
    src = SrcSession()
    dst = DstSession()
    rows = src.query(cls).all()
    for obj in rows:
        data = {}
        for attr in mapper.column_attrs:
            k = attr.key
            data[k] = getattr(obj, k)
        dst.merge(cls(**data))
    dst.commit()
    src.close()
    dst.close()

def main():
    print("Source:", SQLITE_URL)
    print("Destination:", POSTGRES_URL)
    for mapper in Base.registry.mappers:
        print("Migrating:", mapper.class_.__name__)
        copy_table(mapper)
    print("Done")

if __name__ == "__main__":
    main()
