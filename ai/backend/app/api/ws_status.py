from fastapi import APIRouter, WebSocket
import asyncio
from app.services.status_service import USER_STATUS

router = APIRouter()

@router.websocket("/ws/status")
async def status_ws(ws: WebSocket):
    await ws.accept()
    while True:
        await ws.send_json(USER_STATUS)
        await asyncio.sleep(2)
