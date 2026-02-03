
from fastapi import APIRouter, HTTPException, Depends, Request, Form, Header, BackgroundTasks, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
import shutil
import tempfile
import os
import json
import logging

from app.db.session import get_db
from app.db.models.user import User
from app.db.models.voice import VoiceProfile
from app.api.auth import get_current_user
from app.services.huemn_voice_service import HuemnVoiceService
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

class VoiceProfileCreate(BaseModel):
    name: str
    description: Optional[str] = None
    provider: str = "huemn"
    provider_voice_id: str
    model_id: str = "huemn_turbo_v2"
    category: Optional[str] = None
    gender: Optional[str] = None
    language: str = "en"
    accent: Optional[str] = None
    stability: float = 0.5
    similarity_boost: float = 0.75
    style: float = 0.0
    use_speaker_boost: bool = True
    is_public: bool = False

class VoiceProfileUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    settings: Optional[dict] = None

@router.get("/profiles")
def get_voice_profiles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all available voice profiles (public + user's private)"""
    # Get public voices
    public_voices = db.query(VoiceProfile).filter(VoiceProfile.is_public == True).all()
    
    # Get user's private voices
    user_voices = db.query(VoiceProfile).filter(
        VoiceProfile.user_id == current_user.id,
        VoiceProfile.is_public == False
    ).all()
    
    return {
        "success": True,
        "profiles": [v.to_dict() for v in public_voices + user_voices]
    }

@router.post("/profiles")
def create_voice_profile(
    profile: VoiceProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new voice profile manually"""
    # Check if exists
    existing = db.query(VoiceProfile).filter(
        VoiceProfile.provider_voice_id == profile.provider_voice_id,
        VoiceProfile.user_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Voice profile already exists for this ID")
        
    db_profile = VoiceProfile(
        name=profile.name,
        description=profile.description,
        provider=profile.provider,
        provider_voice_id=profile.provider_voice_id,
        model_id=profile.model_id,
        category=profile.category,
        gender=profile.gender,
        language=profile.language,
        accent=profile.accent,
        stability=profile.stability,
        similarity_boost=profile.similarity_boost,
        style=profile.style,
        use_speaker_boost=profile.use_speaker_boost,
        is_public=profile.is_public if getattr(current_user, "role", "viewer") == "admin" else False, # Only admins can create public voices
        user_id=current_user.id
    )
    
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    
    return {"success": True, "profile": db_profile.to_dict()}

@router.delete("/profiles/{profile_id}")
def delete_voice_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a voice profile"""
    profile = db.query(VoiceProfile).filter(VoiceProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
        
    # Check permission
    if profile.user_id != current_user.id and getattr(current_user, "role", "viewer") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this profile")
        
    # If it's a cloned voice (custom), delete from HuemnVoice too
    # We assume if user_id is set, it might be a custom voice
    service = HuemnVoiceService()
    # Note: Logic to determine if it should be deleted from provider could be improved
    # For now, we only delete from DB to be safe, unless explicit flag is added
    
    db.delete(profile)
    db.commit()
    
    return {"success": True}

async def sync_voices_task(db: Session, service: HuemnVoiceService):
    """Background task to sync voices"""
    voices = await service.get_voices()
    if not voices:
        return
        
    count = 0
    for v in voices:
        voice_id = v.get("voice_id")
        name = v.get("name")
        
        # Check if exists as public voice
        existing = db.query(VoiceProfile).filter(
            VoiceProfile.provider_voice_id == voice_id,
            VoiceProfile.is_public == True
        ).first()
        
        if not existing:
            # Create new system voice
            labels = v.get("labels", {})
            profile = VoiceProfile(
                name=name,
                description=labels.get("description", ""),
                provider="huemn",
                provider_voice_id=voice_id,
                category=v.get("category", "generated"),
                gender=labels.get("gender"),
                language="en", # HuemnVoice v2 is multilingual, default en
                accent=labels.get("accent"),
                sample_url=v.get("preview_url"),
                is_public=True,
                user_id=None # System voice
            )
            db.add(profile)
            count += 1
            
    db.commit()
    print(f"Synced {count} new voices from HuemnVoice")

@router.post("/sync")
def sync_huemn_voices(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sync system voices from HuemnVoice"""
    if getattr(current_user, "role", "viewer") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can sync system voices")
        
    service = HuemnVoiceService()
    if not service.is_available():
        raise HTTPException(status_code=400, detail="HuemnVoice API key not configured")
        
    # Run sync in background
    background_tasks.add_task(sync_voices_task, db, service)
    
    return {"success": True, "message": "Voice sync started in background"}

@router.post("/clone")
async def clone_voice(
    name: str,
    files: List[UploadFile] = File(...),
    description: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clone a voice using HuemnVoice Instant Voice Cloning"""
    service = HuemnVoiceService()
    if not service.is_available():
        raise HTTPException(status_code=400, detail="HuemnVoice API key not configured")

    # Save temp files
    temp_files = []
    
    try:
        for file in files:
            # Create temp file
            suffix = os.path.splitext(file.filename)[1] if file.filename else ".mp3"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                shutil.copyfileobj(file.file, tmp)
                temp_files.append(tmp.name)
            
        # Call HuemnVoice add_voice
        voice_id = await service.add_voice(name=name, files=temp_files, description=description)
        
        if not voice_id:
            raise HTTPException(status_code=500, detail="Failed to clone voice on HuemnVoice")
            
        # Create profile in DB
        db_profile = VoiceProfile(
            name=name,
            description=description,
            provider="huemn",
            provider_voice_id=voice_id,
            category="cloned",
            is_public=False,
            is_cloned=True,
            user_id=current_user.id
        )
        db.add(db_profile)
        db.commit()
        db.refresh(db_profile)
        
        return {"success": True, "profile": db_profile.to_dict()}
        
    finally:
        # Cleanup
        for path in temp_files:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except:
                pass
