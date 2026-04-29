from typing import Dict, List, Any
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        # Dict mapping client_id to list of active websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # New: Track specific socket types per client
        # client_id -> { "status": WebSocket, "cast": WebSocket }
        self.typed_connections: Dict[str, Dict[str, WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str, socket_type: str = "status"):
        await websocket.accept()
        
        # Legacy tracking
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)
        
        # Typed tracking
        if client_id not in self.typed_connections:
            self.typed_connections[client_id] = {}
        self.typed_connections[client_id][socket_type] = websocket
        
        logger.info(f"Client {client_id} connected via {socket_type}. Active connections: {len(self.active_connections.get(client_id, []))}")
    
    def disconnect(self, websocket: WebSocket, client_id: str):
        # Legacy cleanup
        if client_id in self.active_connections:
            if websocket in self.active_connections[client_id]:
                self.active_connections[client_id].remove(websocket)
                if not self.active_connections[client_id]:
                    del self.active_connections[client_id]
        
        # Typed cleanup
        if client_id in self.typed_connections:
            for stype, ws in list(self.typed_connections[client_id].items()):
                if ws == websocket:
                    del self.typed_connections[client_id][stype]
            if not self.typed_connections[client_id]:
                del self.typed_connections[client_id]
                
        logger.info(f"Client {client_id} disconnected")
    
    async def send_status(self, event: str, data: Dict[str, Any], client_id: str):
        """Send execution status updates via status socket"""
        payload = {"event": event, "data": data}
        if client_id in self.typed_connections and "status" in self.typed_connections[client_id]:
            await self.typed_connections[client_id]["status"].send_json(payload)
        else:
            # Fallback to legacy
            await self.send_json(payload, client_id)

    async def send_cast(self, frame_data: Any, client_id: str):
        """Send visual casting data (browser frames) via cast socket"""
        if client_id in self.typed_connections and "cast" in self.typed_connections[client_id]:
            # frame_data could be base64 image or binary
            if isinstance(frame_data, dict):
                await self.typed_connections[client_id]["cast"].send_json(frame_data)
            else:
                await self.typed_connections[client_id]["cast"].send_text(str(frame_data))

    async def send_message(self, message: str, client_id: str):
        if client_id in self.active_connections:
            for connection in self.active_connections[client_id]:
                await connection.send_text(message)
    
    async def send_json(self, data: Dict[str, Any], client_id: str):
        if client_id in self.active_connections:
            for connection in self.active_connections[client_id]:
                await connection.send_json(data)
    
    async def broadcast(self, message: str):
        for client_id in self.active_connections:
            for connection in self.active_connections[client_id]:
                await connection.send_text(message)

    async def broadcast_agent_event(self, agent_id: str, event: str, payload: Dict[str, Any]):
        if agent_id in self.active_connections:
            for connection in self.active_connections[agent_id]:
                await connection.send_json({"event": event, "data": payload})

manager = ConnectionManager()
