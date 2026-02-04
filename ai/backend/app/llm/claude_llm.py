import asyncio
from app.llm.base import BaseLLM
from typing import List, Dict, Optional, AsyncGenerator
import logging

logger = logging.getLogger(__name__)

try:
    from anthropic import AsyncAnthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

class ClaudeLLM(BaseLLM):
    async def stream(self, message: str, messages: Optional[List[Dict[str, str]]] = None, model: Optional[str] = None) -> AsyncGenerator[str, None]:
        # Get configuration
        from app.services.config_service import get_llm_config
        config = get_llm_config("claude")
        
        api_key = None
        config_model = "claude-3-sonnet-20240229" # Default
        
        if config and config.get("is_database"):
            api_key = config.get("api_key")
            config_model = config.get("config_data", {}).get("model", config_model)
            
        if not api_key:
            logger.warning("Claude API key not configured.")
            yield "⚠️ Claude API key not configured."
            return

        if not ANTHROPIC_AVAILABLE:
            yield "⚠️ Anthropic library not installed."
            return

        client = AsyncAnthropic(api_key=api_key)
        
        target_model = model or config_model
        
        # Format messages for Claude
        # Claude expects specific role structure (user/assistant alternating)
        # and system prompt is separate in newer API
        
        system_prompt = "You are a helpful assistant."
        formatted_messages = []
        
        if messages:
            for msg in messages:
                if msg["role"] == "system":
                    system_prompt = msg["content"]
                else:
                    formatted_messages.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
        else:
            formatted_messages = [{"role": "user", "content": message}]

        try:
            async with client.messages.stream(
                max_tokens=1024,
                messages=formatted_messages,
                model=target_model,
                system=system_prompt,
            ) as stream:
                async for text in stream.text_stream:
                    yield text
        except Exception as e:
            logger.error(f"Claude error: {e}")
            yield f"Error from Claude: {str(e)}"
