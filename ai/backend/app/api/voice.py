
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import Response
from app.services.telephony_service import telephony_service
from app.services.huemn_voice_service import HuemnVoiceService, LocalVoiceService, resolve_local_sample_path
from app.api.auth import get_current_user
from app.db.models.subscription import UserAccount
from app.db.models.voice import VoiceProfile
from app.db.models.api_config import APIConfig
from app.db.session import get_db, SessionLocal
from app.utils.subscription import consume_tool_tokens
from app.core.config import settings
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional, Any, Dict
from pathlib import Path
import asyncio
import shutil
import uuid
import subprocess
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

def detect_audio_media_type(audio: bytes) -> str:
    if not audio:
        return "application/octet-stream"
    if audio.startswith(b"RIFF") and audio[8:12] == b"WAVE":
        return "audio/wav"
    return "audio/mpeg"

def audio_extension_for_media_type(media_type: str) -> str:
    if media_type == "audio/wav":
        return "wav"
    return "mp3"

def maybe_consume_tool_tokens(db: Session, current_user: UserAccount, tool_name: str, tokens: int = 1) -> None:
    if settings.BYPASS_SUBSCRIPTION:
        return
    consume_tool_tokens(db, current_user, tool_name, tokens)

def get_huemn_voice_api_key(db: Session) -> Optional[str]:
    config = (
        db.query(APIConfig)
        .filter(
            APIConfig.provider_type == "speech",
            APIConfig.provider == "huemn",
            APIConfig.is_active == True
        )
        .order_by(APIConfig.is_default.desc(), APIConfig.id.desc())
        .first()
    )
    if not config:
        return None
    api_key = config.get_api_key()
    return api_key or None

def get_ffmpeg_path() -> Optional[str]:
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        try:
            import imageio_ffmpeg
            ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            ffmpeg_path = None
    if not ffmpeg_path or not os.path.exists(ffmpeg_path):
        return None
    return ffmpeg_path

def convert_to_wav(input_path: Path, output_path: Path, max_seconds: int = 30, timeout_seconds: int = 20) -> Path:
    ffmpeg_path = get_ffmpeg_path()
    if not ffmpeg_path:
        raise HTTPException(status_code=400, detail="Audio conversion requires ffmpeg.")
    result = subprocess.run(
        [
            ffmpeg_path,
            "-y",
            "-i",
            str(input_path),
            "-t",
            str(max_seconds),
            "-ac",
            "1",
            "-ar",
            "22050",
            str(output_path),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout_seconds
    )
    if result.returncode != 0 or not output_path.exists():
        raise HTTPException(status_code=400, detail="Failed to convert audio.")
    return output_path

def extract_voice_settings(profile: Optional[VoiceProfile], overrides: Optional[Dict[str, Any]] = None) -> Dict[str, float]:
    settings: Dict[str, float] = {
        "stability": 0.5,
        "similarity_boost": 0.75,
        "style": 0.0,
        "use_speaker_boost": True
    }
    if profile:
        settings.update({
            "stability": profile.stability,
            "similarity_boost": profile.similarity_boost,
            "style": profile.style,
            "use_speaker_boost": profile.use_speaker_boost
        })
    if overrides:
        settings.update(overrides)
    return settings

async def generate_greeting_audio(profile: VoiceProfile, greeting_script: str, db: Session) -> Optional[str]:
    text = (greeting_script or "").strip()
    if not text:
        return None
    owner_segment = str(profile.user_id or "system")
    preview_dir = Path("uploads/voice_clones") / owner_segment / profile.provider_voice_id
    preview_dir.mkdir(parents=True, exist_ok=True)
    voice_settings = extract_voice_settings(profile)
    if profile.provider == "local":
        local_service = LocalVoiceService()
        if not await local_service.is_available():
            return None
        speaker_wav = resolve_local_sample_path(profile.sample_url)
        audio = await local_service.text_to_speech(
            text=text,
            voice_id=profile.provider_voice_id,
            model_id="local",
            voice_settings=voice_settings,
            speaker_wav=speaker_wav
        )
    else:
        api_key = get_huemn_voice_api_key(db)
        service = HuemnVoiceService(api_key=api_key)
        if not service.is_available():
            return None
        audio = await service.text_to_speech(
            text=text,
            voice_id=profile.provider_voice_id,
            model_id=profile.model_id or "huemn_turbo_v2",
            voice_settings=voice_settings
        )
    if not audio:
        return None
    media_type = detect_audio_media_type(audio)
    ext = audio_extension_for_media_type(media_type)
    output_path = preview_dir / f"greeting.{ext}"
    output_path.write_bytes(audio)
    return f"/uploads/voice_clones/{owner_segment}/{profile.provider_voice_id}/{output_path.name}"

async def generate_greeting_audio_task(profile_id: int, greeting_script: str) -> None:
    db = SessionLocal()
    try:
        profile = db.query(VoiceProfile).filter(VoiceProfile.id == profile_id).first()
        if not profile:
            return
        greeting_audio_url = await generate_greeting_audio(profile, greeting_script, db)
        if greeting_audio_url:
            profile.greeting_audio_url = greeting_audio_url
            db.commit()
    finally:
        db.close()

class VoiceProfilePayload(BaseModel):
    name: str
    description: Optional[str] = None
    greeting_script: Optional[str] = None
    provider: Optional[str] = None
    provider_voice_id: Optional[str] = None
    model_id: Optional[str] = None
    category: Optional[str] = None
    gender: Optional[str] = None
    language: Optional[str] = None
    accent: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    sample_url: Optional[str] = None
    avatar_url: Optional[str] = None
    is_public: Optional[bool] = False

class VoiceProfileUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    greeting_script: Optional[str] = None
    model_id: Optional[str] = None
    category: Optional[str] = None
    gender: Optional[str] = None
    language: Optional[str] = None
    accent: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    sample_url: Optional[str] = None
    avatar_url: Optional[str] = None

@router.get("/token")
async def get_voice_token(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a Twilio Voice Client token for the current user.
    """
    # Use user's email or ID as identity
    maybe_consume_tool_tokens(db, current_user, "voice_studio", 1)
    identity = str(current_user.id)
    token = telephony_service.generate_client_token(identity)
    
    if not token:
        # Return 503 Service Unavailable instead of 500
        # This allows frontend to distinguish between crash and config missing
        raise HTTPException(status_code=503, detail="Voice configuration missing or invalid. Check server logs.")
        
    return {"token": token, "identity": identity}

@router.post("/clone")
async def clone_voice(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    greeting_script: str = Form(...),
    files: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks = None,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    maybe_consume_tool_tokens(db, current_user, "voice_studio", 1)
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")
    api_key = get_huemn_voice_api_key(db)
    service = HuemnVoiceService(api_key=api_key)
    use_remote = service.is_available()
    if not use_remote:
        logger.info("Voice clone using local sample storage (remote API not configured).")
    max_bytes = 6 * 1024 * 1024
    max_total_bytes = 12 * 1024 * 1024
    max_files = 3
    max_audio_seconds = 30
    ffmpeg_timeout_seconds = 60
    allowed_extensions = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".mp4"}
    voice_id = uuid.uuid4().hex
    if use_remote:
        upload_dir = Path("uploads/voices") / str(current_user.id)
    else:
        upload_dir = Path("uploads/voice_clones") / str(current_user.id) / voice_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved_paths: List[Path] = []
    audio_paths: List[Path] = []
    speaker_wav_path: Optional[Path] = None
    cleanup_files = use_remote
    try:
        if len(files) > max_files:
            raise HTTPException(status_code=400, detail="Upload up to 3 audio samples under 6MB each.")
        total_bytes = 0
        for upload in files:
            original_name = Path(upload.filename or "file").name
            ext = Path(original_name).suffix.lower()
            content_type = upload.content_type or ""
            is_audio = content_type.startswith("audio/")
            is_mp4 = content_type == "video/mp4" or ext == ".mp4"
            if ext not in allowed_extensions and not is_audio and not is_mp4:
                raise HTTPException(status_code=400, detail="Only audio or MP4 files up to 6MB are allowed.")
            target_path = upload_dir / f"{uuid.uuid4().hex}_{original_name}"
            with open(target_path, "wb") as buffer:
                shutil.copyfileobj(upload.file, buffer)
            if os.path.getsize(target_path) > max_bytes:
                target_path.unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail="Only audio or MP4 files up to 6MB are allowed.")
            total_bytes += os.path.getsize(target_path)
            if total_bytes > max_total_bytes:
                target_path.unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail="Total upload size must be under 12MB.")
            saved_paths.append(target_path)
            if is_mp4:
                ffmpeg_path = shutil.which("ffmpeg")
                if not ffmpeg_path:
                    try:
                        import imageio_ffmpeg
                        ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
                    except Exception:
                        ffmpeg_path = None
                if not ffmpeg_path or not os.path.exists(ffmpeg_path):
                    raise HTTPException(status_code=400, detail="MP4 support requires ffmpeg. Install ffmpeg or imageio-ffmpeg.")
                output_path = target_path.with_suffix(".mp3")
                result = await asyncio.to_thread(
                    subprocess.run,
                    [
                        ffmpeg_path,
                        "-y",
                        "-i",
                        str(target_path),
                        "-vn",
                        "-t",
                        str(max_audio_seconds),
                        "-ac",
                        "1",
                        "-ar",
                        "44100",
                        "-b:a",
                        "128k",
                        str(output_path),
                    ],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=ffmpeg_timeout_seconds
                )
                if result.returncode != 0 or not output_path.exists():
                    raise HTTPException(status_code=400, detail="Failed to extract audio from MP4.")
                audio_paths.append(output_path)
            else:
                audio_paths.append(target_path)
        if not audio_paths:
            raise HTTPException(status_code=400, detail="No valid audio files to process.")
        if use_remote:
            provider_voice_id = await service.add_voice(name=name, files=[str(p) for p in audio_paths[:2]], description=description)
            if not provider_voice_id:
                raise HTTPException(status_code=503, detail="Voice service unavailable or failed to create voice.")
            profile = VoiceProfile(
                name=name,
                description=description,
                greeting_script=greeting_script,
                provider="huemn",
                provider_voice_id=provider_voice_id,
                model_id="huemn_turbo_v2",
                is_public=False,
                is_cloned=True,
                user_id=current_user.id
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
            if background_tasks:
                background_tasks.add_task(generate_greeting_audio_task, profile.id, greeting_script)
            return {"success": True, "voice_id": provider_voice_id, "profile": profile.to_dict()}
        first_audio = audio_paths[0]
        speaker_wav_path = upload_dir / "speaker.wav"
        if first_audio.suffix.lower() == ".wav":
            shutil.copyfile(first_audio, speaker_wav_path)
        else:
            await asyncio.to_thread(
                convert_to_wav,
                first_audio,
                speaker_wav_path,
                max_audio_seconds,
                ffmpeg_timeout_seconds
            )
        sample_url = f"/uploads/voice_clones/{current_user.id}/{voice_id}/{speaker_wav_path.name}"
        profile = VoiceProfile(
            name=name,
            description=description,
            greeting_script=greeting_script,
            provider="local",
            provider_voice_id=voice_id,
            model_id="local",
            is_public=False,
            is_cloned=True,
            user_id=current_user.id,
            sample_url=sample_url
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        if background_tasks:
            background_tasks.add_task(generate_greeting_audio_task, profile.id, greeting_script)
        return {"success": True, "voice_id": voice_id, "profile": profile.to_dict()}
    finally:
        if cleanup_files:
            for path in audio_paths:
                if path.exists():
                    path.unlink(missing_ok=True)
            for path in saved_paths:
                if path.exists():
                    path.unlink(missing_ok=True)

@router.get("/profiles")
async def list_voice_profiles(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    maybe_consume_tool_tokens(db, current_user, "voice_studio", 1)
    profiles = db.query(VoiceProfile).filter(
        or_(VoiceProfile.is_public == True, VoiceProfile.user_id == current_user.id)
    ).all()
    return {"success": True, "profiles": [p.to_dict() for p in profiles]}

@router.post("/profiles")
async def create_voice_profile(
    payload: VoiceProfilePayload,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    maybe_consume_tool_tokens(db, current_user, "voice_studio", 1)
    if not payload.provider_voice_id:
        raise HTTPException(status_code=400, detail="provider_voice_id is required")
    settings = payload.settings or {}
    is_public = bool(payload.is_public) if current_user.role == "admin" else False
    profile = VoiceProfile(
        name=payload.name,
        description=payload.description,
        greeting_script=payload.greeting_script,
        provider=payload.provider or "huemn",
        provider_voice_id=payload.provider_voice_id,
        model_id=payload.model_id or "huemn_turbo_v2",
        category=payload.category,
        gender=payload.gender,
        language=payload.language or "en",
        accent=payload.accent,
        stability=float(settings.get("stability", 0.5)),
        similarity_boost=float(settings.get("similarity_boost", 0.75)),
        style=float(settings.get("style", 0.0)),
        use_speaker_boost=bool(settings.get("use_speaker_boost", True)),
        sample_url=payload.sample_url,
        avatar_url=payload.avatar_url,
        is_public=is_public,
        is_cloned=False,
        user_id=None if is_public else current_user.id
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return {"success": True, "profile": profile.to_dict()}

@router.put("/profiles/{profile_id}")
async def update_voice_profile(
    profile_id: int,
    payload: VoiceProfileUpdate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    maybe_consume_tool_tokens(db, current_user, "voice_studio", 1)
    profile = db.query(VoiceProfile).filter(VoiceProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    if profile.is_public and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Cannot edit system voice")
    if profile.user_id and profile.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to edit this voice")
    if payload.name is not None:
        profile.name = payload.name
    if payload.description is not None:
        profile.description = payload.description
    if payload.greeting_script is not None:
        profile.greeting_script = payload.greeting_script
        greeting_text = payload.greeting_script.strip()
        if greeting_text:
            greeting_audio_url = await generate_greeting_audio(profile, payload.greeting_script, db)
            if greeting_audio_url:
                profile.greeting_audio_url = greeting_audio_url
        else:
            profile.greeting_audio_url = None
    if payload.model_id is not None:
        profile.model_id = payload.model_id
    if payload.category is not None:
        profile.category = payload.category
    if payload.gender is not None:
        profile.gender = payload.gender
    if payload.language is not None:
        profile.language = payload.language
    if payload.accent is not None:
        profile.accent = payload.accent
    if payload.sample_url is not None:
        profile.sample_url = payload.sample_url
    if payload.avatar_url is not None:
        profile.avatar_url = payload.avatar_url
    if payload.settings is not None:
        profile.stability = float(payload.settings.get("stability", profile.stability))
        profile.similarity_boost = float(payload.settings.get("similarity_boost", profile.similarity_boost))
        profile.style = float(payload.settings.get("style", profile.style))
        profile.use_speaker_boost = bool(payload.settings.get("use_speaker_boost", profile.use_speaker_boost))
    db.commit()
    db.refresh(profile)
    return {"success": True, "profile": profile.to_dict()}

@router.delete("/profiles/{profile_id}")
async def delete_voice_profile(
    profile_id: int,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    maybe_consume_tool_tokens(db, current_user, "voice_studio", 1)
    profile = db.query(VoiceProfile).filter(VoiceProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    if profile.is_public and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Cannot delete system voice")
    if profile.user_id and profile.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this voice")
    db.delete(profile)
    db.commit()
    return {"success": True}

@router.post("/sync")
async def sync_voices(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    maybe_consume_tool_tokens(db, current_user, "voice_studio", 1)
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    api_key = get_huemn_voice_api_key(db)
    service = HuemnVoiceService(api_key=api_key)
    if not service.is_available():
        raise HTTPException(status_code=503, detail="Voice service not configured")
    voices = await service.get_voices()
    added = 0
    updated = 0
    for voice in voices:
        provider_voice_id = voice.get("voice_id") or voice.get("id")
        if not provider_voice_id:
            continue
        profile = db.query(VoiceProfile).filter(
            VoiceProfile.provider == "huemn",
            VoiceProfile.provider_voice_id == provider_voice_id
        ).first()
        preview_url = voice.get("preview_url") or voice.get("sample_url")
        name = voice.get("name") or "Huemn Voice"
        if profile:
            profile.name = name
            profile.sample_url = preview_url or profile.sample_url
            updated += 1
        else:
            profile = VoiceProfile(
                name=name,
                description=voice.get("description"),
                provider="huemn",
                provider_voice_id=provider_voice_id,
                model_id="huemn_turbo_v2",
                is_public=True,
                is_cloned=False,
                sample_url=preview_url
            )
            db.add(profile)
            added += 1
    db.commit()
    return {"success": True, "added": added, "updated": updated, "message": "Voice sync completed in background"}

@router.get("/twilio-speak")
async def twilio_speak(
    text: str = Query(..., min_length=1),
    voice_id: str = Query(..., min_length=1),
    model_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    profile = db.query(VoiceProfile).filter(VoiceProfile.provider_voice_id == voice_id).first()
    provider = profile.provider if profile else "huemn"
    voice_settings = extract_voice_settings(profile)
    resolved_model_id = model_id or (profile.model_id if profile else None) or "huemn_turbo_v2"
    if provider == "local":
        local_service = LocalVoiceService()
        if not await local_service.is_available():
            sample_path = resolve_local_sample_path(profile.sample_url if profile else None)
            if sample_path and os.path.exists(sample_path):
                audio = Path(sample_path).read_bytes()
                return Response(content=audio, media_type=detect_audio_media_type(audio))
            raise HTTPException(status_code=503, detail="Local voice engine not configured")
        speaker_wav = resolve_local_sample_path(profile.sample_url if profile else None)
        audio = await local_service.text_to_speech(
            text=text,
            voice_id=voice_id,
            model_id="local",
            voice_settings=voice_settings,
            speaker_wav=speaker_wav
        )
    else:
        api_key = get_huemn_voice_api_key(db)
        service = HuemnVoiceService(api_key=api_key)
        if not service.is_available():
            raise HTTPException(status_code=503, detail="Voice service not configured")
        audio = await service.text_to_speech(
            text=text,
            voice_id=voice_id,
            model_id=resolved_model_id,
            voice_settings=voice_settings
        )
    if not audio:
        raise HTTPException(status_code=502, detail="Failed to generate audio")
    return Response(content=audio, media_type=detect_audio_media_type(audio))
