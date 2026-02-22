from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.db.session import SessionLocal
from app.db.models.voice import VoiceProfile
from app.services.huemn_voice_service import HuemnVoiceService, LocalVoiceService, resolve_local_sample_path
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.websocket("/ws/voice/stream")
async def voice_stream_ws(websocket: WebSocket):
    await websocket.accept()
    local_service = LocalVoiceService()
    remote_service = HuemnVoiceService()
    
    try:
        while True:
            # Expecting JSON: { "text": "...", "voice_id": "...", "model_id": "...", "settings": {...} }
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                text = payload.get("text")
                voice_id = payload.get("voice_id")
                model_id = payload.get("model_id", "huemn_turbo_v2")
                voice_settings = payload.get("settings") or {}
                optimize_streaming_latency = payload.get("optimize_streaming_latency", 0)
                
                if not text or not voice_id:
                    await websocket.send_json({"error": "Missing text or voice_id"})
                    continue
                
                db = SessionLocal()
                try:
                    profile = db.query(VoiceProfile).filter(VoiceProfile.provider_voice_id == voice_id).first()
                finally:
                    db.close()

                provider = profile.provider if profile else "huemn"
                if profile and not payload.get("settings"):
                    voice_settings = {
                        "stability": profile.stability,
                        "similarity_boost": profile.similarity_boost,
                        "style": profile.style,
                        "use_speaker_boost": profile.use_speaker_boost
                    }

                if provider == "local":
                    if not local_service.is_available():
                        await websocket.send_json({"error": "Local voice engine not configured"})
                        continue
                    speaker_wav = resolve_local_sample_path(profile.sample_url if profile else None)
                    async for chunk in local_service.text_to_speech_stream(
                        text=text,
                        voice_id=voice_id,
                        model_id="local",
                        voice_settings=voice_settings,
                        optimize_streaming_latency=optimize_streaming_latency,
                        speaker_wav=speaker_wav
                    ):
                        await websocket.send_bytes(chunk)
                else:
                    if not remote_service.is_available():
                        await websocket.send_json({"error": "Voice service not configured"})
                        continue
                    async for chunk in remote_service.text_to_speech_stream(
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
