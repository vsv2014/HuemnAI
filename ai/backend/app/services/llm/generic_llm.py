from typing import List, Dict, Any, Optional, AsyncGenerator
import json
import logging
from app.services.llm.provider_service import model_service
from app.db.session import SessionLocal
from app.llm.registry import get_llm

logger = logging.getLogger(__name__)

class GenericLLM:
    """
    Unified LLM Interface for text and vision tasks.
    Uses configured BYOK providers from the database or falls back to system defaults.
    """
    
    def __init__(self, provider_id: Optional[int] = None):
        self.provider_id = provider_id
        self._config = None
        self._instance = None

    def _get_config(self):
        if self.provider_id and not self._config:
            with SessionLocal() as db:
                self._config = model_service.get_provider_config(db, self.provider_id)
        return self._config

    def _get_instance(self):
        if not self._instance:
            config = self._get_config()
            if config:
                provider_name = config.get("provider", "openai")
                self._instance = get_llm(provider_name)
            else:
                from app.llm.registry import get_available_llm
                self._instance = get_available_llm()
        return self._instance

    async def reason_with_vision(self, prompt: str, base64_image: str) -> Dict[str, Any]:
        """
        Sends a screenshot + prompt to a Vision-capable LLM.
        Expected to return a JSON action for self-healing.
        """
        instance = self._get_instance()
        config = self._get_config()
        model = config.get("model") if config else None
        
        # Check if the instance has vision capability
        if hasattr(instance, "reason_with_vision"):
            return await instance.reason_with_vision(prompt, base64_image, model=model)
        
        # Fallback to standard generation with vision if possible
        # Some providers might handle multi-modal inputs in their standard stream/generate
        # For now, we delegate to the instance if it supports it, or log error
        logger.warning(f"LLM instance {type(instance).__name__} does not explicitly support reason_with_vision.")
        
        # Default mock-like response if truly no vision available, but trying to be robust
        return {
            "action": "click",
            "selector": "button",
            "explanation": "Vision reasoning not supported by current provider."
        }

    async def stream(self, prompt: str) -> AsyncGenerator[str, None]:
        """Standard text streaming logic using the underlying LLM instance"""
        instance = self._get_instance()
        config = self._get_config()
        model = config.get("model") if config else None
        
        async for token in instance.stream(prompt, model=model):
            yield token
