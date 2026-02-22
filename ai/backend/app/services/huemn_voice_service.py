import httpx
import logging
import json
import os
import asyncio
import importlib.util
import tempfile
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, AsyncGenerator, Optional, List
from urllib.parse import urlparse
from concurrent.futures import ProcessPoolExecutor
from app.core.config import settings

logger = logging.getLogger(__name__)

LOCAL_TTS_MODEL = os.getenv("LOCAL_TTS_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2")

# Global variables for availability check
_TTS_AVAILABLE = None
_TTS_CHECK_LOCK = asyncio.Lock()
_process_pool = None
_WORKER_TTS = None
_WORKER_TTS_MODEL = None

def get_process_pool():
    global _process_pool
    if _process_pool is None:
        _process_pool = ProcessPoolExecutor(max_workers=1)
    return _process_pool

def resolve_local_sample_path(sample_url: Optional[str]) -> Optional[str]:
    if not sample_url:
        return None
    parsed = urlparse(sample_url)
    path = parsed.path or sample_url
    if path.startswith("/"):
        path = path[1:]
    if path.startswith("uploads/"):
        return path
    if "uploads/" in path:
        idx = path.index("uploads/")
        return path[idx:]
    return None

def _check_tts_import():
    return importlib.util.find_spec("TTS") is not None

def _synthesize_worker(text: str, model_name: str, voice_settings: Dict[str, float], output_format: str, speaker_wav: Optional[str]) -> Optional[bytes]:
    """Worker function to run synthesis in a separate process"""
    try:
        from TTS.api import TTS
        import tempfile
        import shutil
        import subprocess
        from pathlib import Path
        import os
        import imageio_ffmpeg
        
        global _WORKER_TTS, _WORKER_TTS_MODEL
        chosen = model_name
        if _WORKER_TTS is None or _WORKER_TTS_MODEL != chosen:
            try:
                if chosen and os.path.exists(chosen):
                    _WORKER_TTS = TTS(model_path=chosen, progress_bar=False, gpu=False)
                else:
                    _WORKER_TTS = TTS(model_name=chosen, progress_bar=False, gpu=False)
            except Exception:
                _WORKER_TTS = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=False, gpu=False)
            _WORKER_TTS_MODEL = chosen
        tts = _WORKER_TTS

        tmp_dir = Path(tempfile.mkdtemp(prefix="local_tts_"))
        output_wav = tmp_dir / "speech.wav"
        output_final = tmp_dir / "speech.mp3"
        
        tts.tts_to_file(text=text, file_path=str(output_wav), speaker_wav=speaker_wav)
        
        if not output_wav.exists():
            shutil.rmtree(tmp_dir, ignore_errors=True)
            return None
            
        output_bytes: Optional[bytes] = None
        
        if output_format.startswith("mp3"):
            ffmpeg_path = shutil.which("ffmpeg")
            if not ffmpeg_path:
                try:
                    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
                except Exception:
                    ffmpeg_path = None
            
            if not ffmpeg_path or not os.path.exists(ffmpeg_path):
                output_bytes = output_wav.read_bytes()
            else:
                stability = float(voice_settings.get("stability", 0.5))
                similarity = float(voice_settings.get("similarity_boost", 0.75))
                style = float(voice_settings.get("style", 0.0))
                
                # Simple audio effects based on settings
                pitch = max(0.85, min(1.15, 1.0 + (style * 0.15)))
                tempo = max(0.8, min(1.2, 1.0 + ((similarity - 0.75) * 0.2) - ((stability - 0.5) * 0.1)))
                
                result = subprocess.run(
                    [
                        ffmpeg_path,
                        "-y",
                        "-i",
                        str(output_wav),
                        "-filter:a",
                        f"asetrate=44100*{pitch},atempo={tempo}",
                        "-ar",
                        "44100",
                        "-b:a",
                        "128k",
                        str(output_final),
                    ],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=60
                )
                
                if result.returncode == 0 and output_final.exists():
                    output_bytes = output_final.read_bytes()
                else:
                    output_bytes = output_wav.read_bytes()
        else:
            output_bytes = output_wav.read_bytes()
            
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return output_bytes
        
    except Exception as e:
        print(f"Synthesis error: {e}")
        return None

class LocalVoiceService:
    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or LOCAL_TTS_MODEL

    async def is_available(self) -> bool:
        """Fast availability check without importing heavy dependencies"""
        global _TTS_AVAILABLE
        
        if _TTS_AVAILABLE is not None:
            return _TTS_AVAILABLE
            
        async with _TTS_CHECK_LOCK:
            if _TTS_AVAILABLE is not None:
                return _TTS_AVAILABLE
                
            try:
                _TTS_AVAILABLE = bool(_check_tts_import())
            except Exception as e:
                logger.error(f"Error checking TTS availability: {e}")
                _TTS_AVAILABLE = False
                
            return _TTS_AVAILABLE

    async def text_to_speech(
        self,
        text: str,
        voice_id: str,
        model_id: str = "local",
        voice_settings: Optional[Dict[str, float]] = None,
        output_format: str = "mp3_44100_128",
        speaker_wav: Optional[str] = None
    ) -> Optional[bytes]:
        if not await self.is_available():
            return None
            
        loop = asyncio.get_running_loop()
        try:
            pool = get_process_pool()
            return await asyncio.wait_for(
                loop.run_in_executor(
                    pool,
                    _synthesize_worker,
                    text,
                    self.model_name,
                    voice_settings or {},
                    output_format,
                    speaker_wav
                ),
                timeout=300.0
            )
        except Exception as e:
            logger.error(f"Error in text_to_speech: {e}")
            return None

    # Sync method for compatibility if needed, but prefer async
    # Note: The original code didn't use sync text_to_speech, it was async.
    
    async def text_to_speech_stream(
        self,
        text: str,
        voice_id: str,
        model_id: str = "local",
        voice_settings: Optional[Dict[str, float]] = None,
        output_format: str = "mp3_44100_128",
        optimize_streaming_latency: int = 0,
        speaker_wav: Optional[str] = None
    ) -> AsyncGenerator[bytes, None]:
        # Local TTS doesn't support true streaming yet, simulate it
        audio = await self.text_to_speech(
            text=text,
            voice_id=voice_id,
            model_id=model_id,
            voice_settings=voice_settings,
            output_format=output_format,
            speaker_wav=speaker_wav
        )
        if not audio:
            yield b""
            return
        chunk_size = 4096
        for i in range(0, len(audio), chunk_size):
            yield audio[i:i + chunk_size]

class HuemnVoiceService:
    """Service for interacting with HuemnVoice API"""
    
    API_BASE_URL = "https://api.elevenlabs.io/v1"  # HuemnVoice API Endpoint (Provider)
    HUEMN_API_HEADER_KEY = "xi-api-key"
    
    # Model Constants
    MODEL_TURBO = "huemn_turbo_v2"
    MODEL_MULTILINGUAL = "huemn_multilingual_v2"
    MODEL_MONOLINGUAL = "huemn_monolingual_v1"
    
    # Internal mapping for Provider API compatibility
    _MODEL_MAPPING = {
        MODEL_TURBO: "eleven_turbo_v2_5",
        MODEL_MULTILINGUAL: "eleven_multilingual_v2",
        MODEL_MONOLINGUAL: "eleven_monolingual_v1"
    }
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.HUEMN_VOICE_API_KEY
        if not self.api_key:
            # Only log warning if not checking availability explicitly to reduce noise
            pass
            
    def is_available(self) -> bool:
        return bool(self.api_key)
        
    async def get_voices(self) -> List[Dict[str, Any]]:
        """Fetch available voices"""
        if not self.is_available():
            return []
            
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.API_BASE_URL}/voices",
                    headers={self.HUEMN_API_HEADER_KEY: self.api_key}
                )
                response.raise_for_status()
                return response.json().get("voices", [])
            except Exception as e:
                logger.error(f"Error fetching voices: {str(e)}")
                return []
                
    async def text_to_speech(
        self,
        text: str,
        voice_id: str,
        model_id: str = "huemn_turbo_v2",
        voice_settings: Optional[Dict[str, float]] = None,
        output_format: str = "mp3_44100_128"
    ) -> Optional[bytes]:
        """Convert text to speech (non-streaming) with fallback"""
        if not self.is_available():
            return None
            
        # Define fallback strategy
        models_to_try = [model_id]
        if model_id == self.MODEL_TURBO:
            models_to_try.extend([self.MODEL_MULTILINGUAL, self.MODEL_MONOLINGUAL])
        elif model_id == self.MODEL_MULTILINGUAL:
            models_to_try.append(self.MODEL_MONOLINGUAL)
             
        last_error = None
        
        for current_model in models_to_try:
            # Map to internal API model ID
            api_model_id = self._MODEL_MAPPING.get(current_model, current_model)
            
            try:
                url = f"{self.API_BASE_URL}/text-to-speech/{voice_id}?output_format={output_format}"
                
                payload = {
                    "text": text,
                    "model_id": api_model_id,
                    "voice_settings": voice_settings or {
                        "stability": 0.5,
                        "similarity_boost": 0.75
                    }
                }
                
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        url,
                        json=payload,
                        headers={
                            self.HUEMN_API_HEADER_KEY: self.api_key,
                            "Content-Type": "application/json"
                        },
                        timeout=120.0
                    )
                    response.raise_for_status()
                    logger.info(f"Generated TTS with model: {current_model}")
                    return response.content
            except Exception as e:
                logger.warning(f"TTS generation failed for model {current_model}: {str(e)}")
                last_error = e
                continue
                
        logger.error(f"All TTS models failed. Last error: {str(last_error)}")
        return None

    async def text_to_speech_stream(
        self,
        text: str,
        voice_id: str,
        model_id: str = "huemn_turbo_v2",
        voice_settings: Optional[Dict[str, float]] = None,
        output_format: str = "mp3_44100_128",
        optimize_streaming_latency: int = 0
    ) -> AsyncGenerator[bytes, None]:
        """Convert text to speech (streaming) with retry and fallback"""
        if not self.is_available():
            yield b""
            return
            
        # Define fallback strategy
        models_to_try = [model_id]
        if model_id == self.MODEL_TURBO:
            models_to_try.extend([self.MODEL_MULTILINGUAL, self.MODEL_MONOLINGUAL])
        elif model_id == self.MODEL_MULTILINGUAL:
             models_to_try.append(self.MODEL_MONOLINGUAL)
             
        last_error = None
        
        for current_model in models_to_try:
            # Map to internal API model ID
            api_model_id = self._MODEL_MAPPING.get(current_model, current_model)
            
            try:
                # Adjust latency optimization for non-turbo models if needed, 
                # but API usually ignores it if not supported.
                current_latency_opt = optimize_streaming_latency
                if current_model != self.MODEL_TURBO:
                    current_latency_opt = 0 # Disable for standard models
                
                url = f"{self.API_BASE_URL}/text-to-speech/{voice_id}/stream?output_format={output_format}&optimize_streaming_latency={current_latency_opt}"
                
                payload = {
                    "text": text,
                    "model_id": api_model_id,
                    "voice_settings": voice_settings or {
                        "stability": 0.5,
                        "similarity_boost": 0.75
                    }
                }
                
                async with httpx.AsyncClient() as client:
                    async with client.stream(
                        "POST",
                        url,
                        json=payload,
                        headers={
                            self.HUEMN_API_HEADER_KEY: self.api_key,
                            "Content-Type": "application/json"
                        },
                        timeout=30.0
                    ) as response:
                        response.raise_for_status()
                        
                        logger.info(f"Streaming TTS with model: {current_model}")
                        
                        async for chunk in response.aiter_bytes():
                            yield chunk
                        
                        # If we completed successfully, return
                        return
                        
            except Exception as e:
                logger.warning(f"TTS streaming failed for model {current_model}: {str(e)}")
                last_error = e
                # Continue to next model in list
                continue
                
        logger.error(f"All TTS models failed. Last error: {str(last_error)}")
    async def add_voice(self, name: str, files: List[str], description: Optional[str] = None) -> Optional[str]:
        """Add/Clone a new voice"""
        if not self.is_available():
            return None
            
        url = f"{self.API_BASE_URL}/voices/add"
        
        async with httpx.AsyncClient() as client:
            try:
                # Prepare multipart form data
                data = {"name": name}
                if description:
                    data["description"] = description
                    
                files_list = []
                opened_files = []
                
                for file_path in files:
                    f = open(file_path, "rb")
                    opened_files.append(f)
                    files_list.append(("files", (os.path.basename(file_path), f, "audio/mpeg")))
                
                response = await client.post(
                    url,
                    data=data,
                    files=files_list,
                    headers={self.HUEMN_API_HEADER_KEY: self.api_key},
                    timeout=120.0
                )
                
                # Close files
                for f in opened_files:
                    f.close()
                    
                response.raise_for_status()
                return response.json().get("voice_id")
            except Exception as e:
                logger.error(f"Error adding voice: {str(e)}")
                # Ensure files are closed in case of error
                for f in locals().get("opened_files", []):
                    try: f.close()
                    except: pass
                return None

    async def delete_voice(self, voice_id: str) -> bool:
        """Delete a voice"""
        if not self.is_available():
            return False
            
        url = f"{self.API_BASE_URL}/voices/{voice_id}"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.delete(
                    url,
                    headers={self.HUEMN_API_HEADER_KEY: self.api_key}
                )
                response.raise_for_status()
                return True
            except Exception as e:
                logger.error(f"Error deleting voice: {str(e)}")
                return False
