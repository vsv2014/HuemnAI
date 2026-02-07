from fastapi import APIRouter, WebSocket, Query
from app.services.socket_manager import manager

router = APIRouter()

@router.websocket("/ws/crm")
async def crm_ws(websocket: WebSocket, client_id: str = Query("crm")):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_message(data, client_id)
    except Exception:
        try:
            manager.disconnect(websocket, client_id)
        except Exception:
            pass
