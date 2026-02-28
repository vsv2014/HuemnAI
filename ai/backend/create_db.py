import psycopg2
from app.core.config import settings
import os
from urllib.parse import urlparse

# Get connection info from settings
db_name = settings.POSTGRES_DB or "huemn"
password = settings.POSTGRES_PASSWORD or "Dsvsk@2001"
user = settings.POSTGRES_USER or "postgres"

try:
    # Connect to default postgres db
    conn = psycopg2.connect(
        user=user,
        password=password,
        host="localhost",
        port=5432,
        dbname="postgres"
    )
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Check if database exists
    db_name = settings.POSTGRES_DB or "huemn"
    cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'")
    exists = cursor.fetchone()
    
    if not exists:
        print(f"Creating database {db_name}...")
        cursor.execute(f"CREATE DATABASE {db_name}")
        print("Database created successfully")
    else:
        print(f"Database {db_name} already exists")
        
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
