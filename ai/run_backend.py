"""Run backend reliably from repo root.
Usage: python run_backend.py
This ensures the 'backend' package is on sys.path then launches uvicorn.
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"

# Add backend dir to sys.path
sys.path.insert(0, str(BACKEND))

import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("BACKEND_PORT", "8001"))
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    print(f"Starting backend on http://{host}:{port} (app from backend/app.main:app)")
    print(f"Accessible from network at http://192.168.1.8:{port}")
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
