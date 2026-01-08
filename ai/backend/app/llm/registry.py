from app.llm.openai_llm import OpenAILLM
from app.llm.azure_llm import AzureLLM
from app.core.config import settings
from app.services.config_service import get_llm_config
import os
import logging

logger = logging.getLogger(__name__)

_LLM_INSTANCES = {}

def get_llm(name: str = None):
    """
    Get LLM instance. Auto-detects available provider if name not specified.
    STRICT: Only uses UI Configuration (database), no environment variable fallback.
    """
    # Auto-detect if no name provided
    if name is None:
        # STRICT: Only check UI configuration (database)
        try:
            # Check for default LLM from UI
            ui_config = get_llm_config()  # Gets default provider
            if ui_config and ui_config.get("is_database") and ui_config.get("api_key"):
                name = ui_config.get("provider", "openai")
            # Check for OpenAI in UI
            elif get_llm_config("openai") and get_llm_config("openai").get("is_database") and get_llm_config("openai").get("api_key"):
                name = "openai"
            # Check for Azure in UI
            elif get_llm_config("azure") and get_llm_config("azure").get("is_database") and get_llm_config("azure").get("api_key"):
                name = "azure"
            else:
                # No UI config - default to openai (will return error when used)
                name = "openai"
        except Exception as e:
            logger.debug(f"Error checking UI config: {e}")
            # No fallback - default to openai (will return error when used)
            name = "openai"
    
    if name not in _LLM_INSTANCES:
        if name == "openai":
            _LLM_INSTANCES[name] = OpenAILLM()
        elif name == "azure":
            _LLM_INSTANCES[name] = AzureLLM()
        else:
            # Fallback to OpenAI if unknown
            _LLM_INSTANCES[name] = OpenAILLM()
    return _LLM_INSTANCES[name]

def get_available_llm():
    """
    Get the best available LLM provider based on configured keys.
    STRICT: Only uses UI Configuration (database), no environment variable fallback.
    """
    try:
        # STRICT: Only check UI configuration (database)
        ui_config = get_llm_config()  # Gets default provider
        if ui_config and ui_config.get("is_database") and ui_config.get("api_key"):
            return get_llm(ui_config.get("provider", "openai"))
        
        # Check OpenAI in UI
        openai_config = get_llm_config("openai")
        if openai_config and openai_config.get("is_database") and openai_config.get("api_key"):
            return get_llm("openai")
        
        # Check Azure in UI
        azure_config = get_llm_config("azure")
        if azure_config and azure_config.get("is_database") and azure_config.get("api_key"):
            return get_llm("azure")
    except Exception as e:
        logger.debug(f"Error checking UI config: {e}")
    
    # NO FALLBACK - return openai instance (will return error when used)
    return get_llm("openai")
