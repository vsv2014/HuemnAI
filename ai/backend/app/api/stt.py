from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import Optional
from app.services.stt.openai_stt import OpenAISTT
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None)
):
    """
    Transcribe uploaded audio file using configured STT provider (Default: OpenAI Whisper).
    """
    try:
        # Initialize STT Service (Factory logic can go here later)
        stt_service = OpenAISTT()
        
        # Transcribe
        # UploadFile.file is a SpooledTemporaryFile which is binary
        # We need to ensure it has a name for OpenAI SDK
        file.file.name = file.filename 
        
        transcript = await stt_service.transcribe(file.file, language=language)
        
        return {"text": transcript}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail="Transcription failed")
