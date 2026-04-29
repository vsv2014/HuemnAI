from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.socket_manager import manager
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.websocket("/ws/execution/{client_id}/{socket_type}")
async def execution_socket(websocket: WebSocket, client_id: str, socket_type: str):
    """
    Unified execution socket handling:
    - socket_type='status': Execution logs, token streams
    - socket_type='cast': Visual frames, screenshots
    - socket_type='extension': Real-time recording from Chrome Extension
    """
    if socket_type not in ["status", "cast", "extension"]:
        await websocket.close(code=4000, reason="Invalid socket type")
        return

    await manager.connect(websocket, client_id, socket_type)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Handle messages based on socket type
            if socket_type == "extension":
                msg_type = data.get("type")
                
                if msg_type == "HUEMN_RECORD_STEP":
                    step = data.get("step")
                    logger.info(f"Received step from extension for {client_id}: {step}")
                    # Relay to status socket for the log view
                    await manager.send_status("HUEMN_RECORD_STEP", {"step": step}, client_id)
                    # Relay to cast socket for visual indicator
                    await manager.send_cast({"type": "recording_indicator", "active": True, "last_step": step}, client_id)
                
                elif msg_type == "HUEMN_RECORDING_STARTED":
                    logger.info(f"Recording started for {client_id}")
                    await manager.send_status("HUEMN_RECORDING_STARTED", {"timestamp": data.get("timestamp")}, client_id)
                
                elif msg_type == "HUEMN_RECORDING_STOPPED":
                    logger.info(f"Recording stopped for {client_id}")
                    await manager.send_status("HUEMN_RECORDING_STOPPED", {"workflow": data.get("workflow")}, client_id)
                
                elif msg_type == "HUEMN_BROWSER_EVENT":
                    # Generic browser events (navigation, etc.)
                    await manager.send_status("HUEMN_BROWSER_EVENT", data.get("payload", {}), client_id)
            
            elif socket_type == "status":
                # Handle control messages from the UI
                action = data.get("action")
                if action == "STOP":
                    logger.info(f"Stop request received for {client_id}")
                    # In a real implementation, this would signal the executor to stop
                    await manager.send_status("execution_stopped", {"reason": "User requested stop"}, client_id)
                
                elif action == "RESUME":
                    logger.info(f"Resume request received for {client_id}")
                    await manager.send_status("execution_resumed", {}, client_id)
                
                elif action == "APPROVE":
                    # Handle manual approval from the Status socket
                    ticket_id = data.get("ticket_id")
                    logger.info(f"Manual approval received for ticket {ticket_id} from {client_id}")
                    # Update ticket status in DB
                    from app.db.session import SessionLocal
                    from app.db.models.ticket import Ticket
                    db = SessionLocal()
                    try:
                        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
                        if ticket:
                            ticket.status = "approved"
                            db.commit()
                            await manager.send_status("approval_received", {"ticket_id": ticket_id, "status": "approved"}, client_id)
                    finally:
                        db.close()
                
                elif action == "REJECT":
                    ticket_id = data.get("ticket_id")
                    from app.db.session import SessionLocal
                    from app.db.models.ticket import Ticket
                    db = SessionLocal()
                    try:
                        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
                        if ticket:
                            ticket.status = "rejected"
                            db.commit()
                            await manager.send_status("approval_received", {"ticket_id": ticket_id, "status": "rejected"}, client_id)
                    finally:
                        db.close()
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
    except Exception as e:
        logger.error(f"Error in execution socket {client_id}/{socket_type}: {e}")
        manager.disconnect(websocket, client_id)
