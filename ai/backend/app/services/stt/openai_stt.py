from typing import BinaryIO, Optional
from app.services.stt.base import BaseSTT
from app.services.config_service import get_llm_config
import logging
import io

logger = logging.getLogger(__name__)

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

class OpenAISTT(BaseSTT):
    async def transcribe(self, audio_file: BinaryIO, language: Optional[str] = None) -> str:
        # Get configuration (reuse OpenAI LLM config for API key)
        config = get_llm_config("openai")
        api_key = None
        
        if config and config.get("is_database"):
            api_key = config.get("api_key")
            
        if not api_key:
            logger.warning("OpenAI API key not configured for STT.")
            raise ValueError("OpenAI API key not configured")

        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI library not installed")

        client = OpenAI(api_key=api_key)
        
        # Ensure we're at the start of the file
        if hasattr(audio_file, 'seek'):
            audio_file.seek(0)
            
        # We need to ensure the file has a name attribute for OpenAI SDK to detect format
        # If it's a SpooledTemporaryFile from FastAPI, it might need handling
        if not hasattr(audio_file, 'name') or not audio_file.name:
            # Wrap in a named buffer if needed, but usually FastAPI UploadFile has filename
            pass

        try:
            # Call OpenAI Whisper API
            transcript = client.audio.transcriptions.create(
                model="whisper-1", 
                file=audio_file,
                language=language
            )
            return transcript.text
        except Exception as e:
            logger.error(f"STT Error: {e}")
            raise e
