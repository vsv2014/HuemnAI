from sqlalchemy.orm import Session
from app.db.models.enterprise import AIModel, ModelProvider
from app.db.models.agent import Agent
from app.core.security import encrypt_string, decrypt_string
from typing import List, Optional, Dict, Any

class ModelProviderService:
    @staticmethod
    def add_provider(
        db: Session, 
        agent_id: int, 
        name: str, 
        provider_type: ModelProvider, 
        model_name: str,
        api_key: str,
        base_url: Optional[str] = None,
        settings: Optional[Dict[str, Any]] = None
    ) -> AIModel:
        """Adds a new AI model provider with encrypted keys (BYOK)"""
        provider = AIModel(
            agent_id=agent_id,
            name=name,
            provider=provider_type,
            model_name=model_name,
            base_url=base_url,
            settings=settings or {}
        )
        provider.set_api_key(api_key)
        db.add(provider)
        db.commit()
        db.refresh(provider)
        return provider

    @staticmethod
    def get_active_providers(db: Session, agent_id: int) -> List[AIModel]:
        """Returns all configured providers for an agent"""
        return db.query(AIModel).filter(AIModel.agent_id == agent_id, AIModel.is_active == True).all()

    @staticmethod
    def get_provider_config(
        db: Session, provider_id: int, owner_user_id: int
    ) -> Dict[str, Any]:
        """Resolve BYOK only inside an explicitly authorized agent ownership scope.

        Never select/decrypt an arbitrary model credential by globally visible ID.
        """
        if not isinstance(owner_user_id, int) or isinstance(owner_user_id, bool) or owner_user_id <= 0:
            raise ValueError("Authenticated owner_user_id is required")
        provider = db.query(AIModel).join(
            Agent, AIModel.agent_id == Agent.id
        ).filter(
            AIModel.id == provider_id,
            Agent.user_id == owner_user_id
        ).first()
        if not provider:
            return {}
        
        return {
            "provider": provider.provider.value,
            "model": provider.model_name,
            "api_key": provider.get_api_key(),
            "base_url": provider.base_url,
            "settings": provider.settings
        }

model_service = ModelProviderService()
