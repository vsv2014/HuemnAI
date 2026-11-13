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
    async def stream(
        self, message: str, messages: Optional[List[Dict[str, str]]] = None,
        model: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 2000
    ) -> AsyncGenerator[str, None]:
        """Anthropic SDK streaming with explicit provider errors."""
        from app.services.config_service import get_llm_config
        config = get_llm_config("anthropic") or {}
        key = config.get("api_key")
        data = config.get("config_data") or {}
        selected = model or data.get("model")
        if not key:
            raise RuntimeError("Anthropic credentials are not configured")
        if not ANTHROPIC_AVAILABLE:
            raise RuntimeError("Anthropic SDK is not installed")
        if not selected:
            raise RuntimeError("No Anthropic model configured")

        system = "You are a helpful assistant."
        formatted = []
        for item in (messages or [{"role": "user", "content": message}]):
            if item.get("role") == "system":
                system = str(item.get("content", system))
            elif item.get("role") in ("user", "assistant"):
                formatted.append({"role": item["role"], "content": item["content"]})
        if not formatted:
            formatted = [{"role": "user", "content": message}]

        client = AsyncAnthropic(api_key=key, timeout=45, max_retries=0)
        try:
            async with client.messages.stream(
                max_tokens=max_tokens, messages=formatted, model=selected,
                system=system, temperature=temperature
            ) as response:
                async for token in response.text_stream:
                    yield token
        except Exception as exc:
            logger.warning("Anthropic inference failed (%s)", type(exc).__name__)
            raise RuntimeError("Anthropic inference failed") from exc
        finally:
            await client.close()
