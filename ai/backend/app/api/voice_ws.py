from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.huemn_voice_service import HuemnVoiceService
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.websocket("/ws/voice/stream")
async def voice_stream_ws(websocket: WebSocket):
    await websocket.accept()
    service = HuemnVoiceService()
    
    if not service.is_available():
        await websocket.send_json({"error": "Voice service not configured"})
        await websocket.close()
        return
    
    try:
        while True:
            # Expecting JSON: { "text": "...", "voice_id": "...", "model_id": "...", "settings": {...} }
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                text = payload.get("text")
                voice_id = payload.get("voice_id")
                model_id = payload.get("model_id", "huemn_turbo_v2")
                voice_settings = payload.get("settings")
                optimize_streaming_latency = payload.get("optimize_streaming_latency", 0)
                
                if not text or not voice_id:
                    await websocket.send_json({"error": "Missing text or voice_id"})
                    continue
                
                # Stream audio
                async for chunk in service.text_to_speech_stream(
                    text=text,
                    voice_id=voice_id,
                    model_id=model_id,
                    voice_settings=voice_settings,
                    optimize_streaming_latency=optimize_streaming_latency
                ):
                    await websocket.send_bytes(chunk)
                    
                # Send completion marker
                await websocket.send_text(json.dumps({"status": "done"}))
                
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
            except Exception as e:
                logger.error(f"Error in voice stream: {str(e)}")
                await websocket.send_json({"error": str(e)})
                
    except WebSocketDisconnect:
        logger.info("Voice stream client disconnected")
