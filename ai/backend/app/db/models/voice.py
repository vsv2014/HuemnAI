from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class VoiceProfile(Base):
    """Voice Profile model for managing TTS voices"""
    __tablename__ = "voice_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Provider details
    provider = Column(String(50), default="huemn", nullable=False) # huemn, azure, openai, google
    provider_voice_id = Column(String(255), nullable=False) # ID from the provider
    model_id = Column(String(100), default="huemn_turbo_v2")
    
    # Voice Metadata
    category = Column(String(50), nullable=True) # narrative, conversational, news
    gender = Column(String(20), nullable=True) # male, female, neutral
    language = Column(String(10), default="en") # en, es, fr
    accent = Column(String(50), nullable=True) # american, british, australian
    
    # Default Settings
    stability = Column(Float, default=0.5)
    similarity_boost = Column(Float, default=0.75)
    style = Column(Float, default=0.0)
    use_speaker_boost = Column(Boolean, default=True)
    
    # Assets
    sample_url = Column(String(500), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Ownership & Visibility
    is_public = Column(Boolean, default=False) # System voices are public
    is_cloned = Column(Boolean, default=False) # Was this voice cloned?
    user_id = Column(Integer, nullable=True) # Owner (if private/cloned)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "provider": self.provider,
            "provider_voice_id": self.provider_voice_id,
            "model_id": self.model_id,
            "category": self.category,
            "gender": self.gender,
            "language": self.language,
            "accent": self.accent,
            "settings": {
                "stability": self.stability,
                "similarity_boost": self.similarity_boost,
                "style": self.style,
                "use_speaker_boost": self.use_speaker_boost
            },
            "sample_url": self.sample_url,
            "avatar_url": self.avatar_url,
            "is_public": self.is_public,
            "is_cloned": self.is_cloned,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
