#from app.core.config import settings
#from app.llm.registry import get_llm
#from app.services.decision_engine import rule_based_decision

#async def stream_response(message: str):
    #if settings.LLM_MODE == "rules":
        #yield rule_based_decision(message)
        #return

    #llm = get_llm(settings.DEFAULT_LLM)
    #async for token in llm.stream(message):
        #yield token

from app.core.config import settings
from app.llm.registry import get_llm, get_available_llm
from app.services.config_service import get_llm_config
import logging
import os

logger = logging.getLogger(__name__)

async def explain(message: str):
    """
    Stream tokens from LLM.
    Auto-detects and uses the best available LLM provider (OpenAI, Azure, etc.)
    REQUIRES LLM configuration via UI Settings (not environment variables).
    """
    # Check if LLM is configured via UI Settings (database)
    config = get_llm_config()
    has_ui_config = config and config.get("is_database") and config.get("api_key")
    
    # STRICT: Only allow UI-configured keys, not environment variables
    if not has_ui_config:
        error_message = "⚠️ LLM API key not configured. Please configure your LLM provider in Settings to use this feature. Go to Settings → Add Configuration → LLM Provider → OpenAI (or Azure/Anthropic)."
        for word in error_message.split():
            yield word + " "
            import asyncio
            await asyncio.sleep(0.05)
        return
    
    # Use auto-detection to get the best available LLM
    llm = get_available_llm()
    async for token in llm.stream(message):
        yield token
