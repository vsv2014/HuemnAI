import asyncio
from app.llm.base import BaseLLM
from typing import List, Dict, Optional, AsyncGenerator
import logging
import os

logger = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

class GeminiLLM(BaseLLM):
    async def stream(
        self, message: str, messages: Optional[List[Dict[str, str]]] = None,
        model: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 2000
    ) -> AsyncGenerator[str, None]:
        """Use the Google GenAI async SDK, with typed failures and no fake tokens."""
        from app.services.config_service import get_llm_config
        config = get_llm_config("google") or {}
        key = config.get("api_key")
        data = config.get("config_data") or {}
        selected = model or data.get("model")
        if not key:
            raise RuntimeError("Google GenAI credentials are not configured")
        if not GEMINI_AVAILABLE:
            raise RuntimeError("Google GenAI SDK is not installed")
        if not selected:
            raise RuntimeError("No Google GenAI model configured")

        history = messages or [{"role": "user", "content": message}]
        system_instructions = [x["content"] for x in history if x.get("role") == "system"]
        contents = []
        for item in history:
            role = item.get("role")
            if role in ("user", "assistant"):
                contents.append(types.Content(
                    role="user" if role == "user" else "model",
                    parts=[types.Part.from_text(text=str(item.get("content", "")))]
                ))
        if not contents:
            contents = [types.Content(role="user", parts=[types.Part.from_text(text=message)])]
        options = {"temperature": temperature, "max_output_tokens": max_tokens}
        if system_instructions:
            options["system_instruction"] = "\n".join(system_instructions)

        client = genai.Client(api_key=key)
        try:
            response = await client.aio.models.generate_content_stream(
                model=selected,
                contents=contents,
                config=types.GenerateContentConfig(**options),
            )
            async for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as exc:
            logger.warning("Google GenAI inference failed (%s)", type(exc).__name__)
            raise RuntimeError("Google GenAI inference failed") from exc
        finally:
            await client.aio.aclose()
