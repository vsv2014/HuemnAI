import httpx
import logging
import json
import os
from typing import Dict, Any, AsyncGenerator, Optional, List
from app.core.config import settings

logger = logging.getLogger(__name__)

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
            logger.warning("HuemnVoice API key not configured")
            
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
                        timeout=30.0
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
                            self.API_HEADER_KEY: self.api_key,
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
                    headers={self.API_HEADER_KEY: self.api_key},
                    timeout=60.0
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
                    headers={self.API_HEADER_KEY: self.api_key}
                )
                response.raise_for_status()
                return True
            except Exception as e:
                logger.error(f"Error deleting voice: {str(e)}")
                return False
