import asyncio
import json
from typing import Dict, Any, List, Optional
from app.llm.base import BaseLLM
from app.core.config import settings
import os

# Try to import OpenAI SDK
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None


class OpenAILLM(BaseLLM):
    async def stream(
        self,
        message: str,
        messages: list = None,
        model: str = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ):
        """Stream only real model tokens; never synthesize answers on provider errors."""
        import logging
        from app.services.config_service import get_llm_config

        logger = logging.getLogger(__name__)
        config = get_llm_config("openai") or {}
        api_key = config.get("api_key") or os.getenv("OPENAI_API_KEY")
        data = config.get("config_data") or {}
        primary = model or data.get("model") or os.getenv("OPENAI_MODEL")
        if not api_key:
            raise RuntimeError("OpenAI is not configured with valid credentials")
        if not OPENAI_AVAILABLE:
            raise RuntimeError("OpenAI SDK is not installed")
        if not primary:
            raise RuntimeError("No OpenAI model selected; configure a model in Settings")

        # Only caller-configured fallback IDs may be used; never invent a
        # supposed safe model or silently rewrite a deprecated model name.
        fallbacks = [] if model else data.get("fallback_models") or []
        if isinstance(fallbacks, str):
            fallbacks = [item.strip() for item in fallbacks.split(",")]
        models = list(dict.fromkeys([
            item for item in [primary, *fallbacks]
            if isinstance(item, str) and item.strip()
        ]))
        conversation = messages or [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": message},
        ]

        from openai import AsyncOpenAI
        async with AsyncOpenAI(api_key=api_key, timeout=45, max_retries=0) as client:
            for index, selected_model in enumerate(models):
                emitted = False
                try:
                    response = await client.chat.completions.create(
                        model=selected_model,
                        messages=conversation,
                        stream=True,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                    async for chunk in response:
                        if chunk.choices:
                            delta = chunk.choices[0].delta
                            if delta and delta.content:
                                emitted = True
                                yield delta.content
                    if not emitted:
                        raise RuntimeError("The model returned no usable text")
                    return
                except Exception as exc:
                    # Never combine partial output from two models in one answer.
                    logger.warning(
                        "OpenAI model execution failed (model=%s type=%s)",
                        selected_model, type(exc).__name__,
                    )
                    if emitted or index == len(models) - 1:
                        raise RuntimeError("AI model inference failed") from exc

        raise RuntimeError("AI model inference failed")


    async def reason_with_vision(self, prompt: str, base64_image: str, model: str = "gpt-4o") -> Dict[str, Any]:
        """
        Sends a screenshot + prompt to OpenAI Vision API.
        Returns a JSON action for self-healing.
        """
        from app.services.config_service import get_llm_config
        config = get_llm_config("openai")
        api_key = config.get("api_key") if config and config.get("is_database") else os.getenv("OPENAI_API_KEY")

        if not api_key:
            return {"error": "OpenAI API key not configured"}

        if not OPENAI_AVAILABLE:
            return {"error": "OpenAI SDK not available"}

        client = OpenAI(api_key=api_key)
        
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=500,
                response_format={ "type": "json_object" }
            )
            
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"OpenAI Vision error: {e}")
            return {"error": str(e)}
