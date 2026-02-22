from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json
import logging
import asyncio
from app.db.session import SessionLocal
from app.db.models.agent import AgentConversation, AgentMessage

logger = logging.getLogger(__name__)

router = APIRouter()

class CallTranscriptManager:
    def __init__(self):
        # session_id -> List[WebSocket]
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)
        logger.info(f"Client connected to transcript for session {session_id}")

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
        logger.info(f"Client disconnected from transcript for session {session_id}")

    async def broadcast(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending transcript: {e}")

manager = CallTranscriptManager()

@router.websocket("/ws/call/{session_id}/transcript")
async def call_transcript_ws(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        # Keep connection open
        while True:
            # We don't expect much input from client, but we need to keep the loop
            # Maybe receive "ping" or control messages
            data = await websocket.receive_text()
            # echo or ignore
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, session_id)

# Helper to push updates (can be called by other services)
async def push_transcript_update(session_id: str, role: str, text: str, timestamp: float = None):
    """
    Push a new transcript segment to all connected clients for a session.
    """
    import time
    if timestamp is None:
        timestamp = time.time()
        
    message = {
        "type": "transcript",
        "role": role,
        "text": text,
        "timestamp": timestamp
    }
    await manager.broadcast(session_id, message)

    db = SessionLocal()
    try:
        conversation = db.query(AgentConversation).filter(
            AgentConversation.session_id == session_id
        ).first()
        if conversation:
            normalized_role = "assistant" if role in ["assistant", "agent"] else "user"
            db.add(AgentMessage(
                conversation_id=conversation.id,
                role=normalized_role,
                content=text
            ))
            db.commit()
    finally:
        db.close()

# Simulation Endpoint (for testing)
@router.post("/call/{session_id}/simulate-transcript")
async def simulate_transcript(session_id: str, role: str, text: str):
    await push_transcript_update(session_id, role, text)
    return {"status": "sent"}
