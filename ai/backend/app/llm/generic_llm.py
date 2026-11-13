
import os
import json
import asyncio
import httpx
from typing import List, Dict, Any, Optional, AsyncGenerator
from app.llm.base import BaseLLM
import logging

logger = logging.getLogger(__name__)

class LLMProviderError(RuntimeError):
    """A provider failed, misconfigured, or returned an incompatible stream."""


class GenericLLM(BaseLLM):
    """
    Generic LLM class for OpenAI-compatible APIs (Groq, Together, Ollama, etc.)
    """
    
    def __init__(self, provider: str):
        self.provider = provider
        
    async def stream(
        self,
        message: str,
        messages: Optional[List[Dict[str, str]]] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> AsyncGenerator[str, None]:
        from app.services.config_service import get_llm_config
        config = get_llm_config(self.provider)
        
        if not config or not config.get("is_database"):
            logger.warning(f"{self.provider} config not found in database.")
            raise LLMProviderError(f"{self.provider} is not configured in Settings")

        api_key = config.get("api_key")
        config_data = config.get("config_data") or {}
        
        # Determine endpoint and model
        endpoint = config.get("endpoint")
        if not endpoint:
            if self.provider == "groq":
                endpoint = "https://api.groq.com/openai/v1/chat/completions"
            elif self.provider == "together":
                endpoint = "https://api.together.xyz/v1/chat/completions"
            elif self.provider == "ollama":
                endpoint = config_data.get("endpoint", "http://localhost:11434") + "/v1/chat/completions"
            elif self.provider == "mistral":
                endpoint = "https://api.mistral.ai/v1/chat/completions"
            elif self.provider == "cohere":
                endpoint = "https://api.cohere.ai/v1/chat/completions"
            else:
                endpoint = config_data.get("endpoint")

        target_model = model or config_data.get("model")
        
        if self.provider != "ollama" and not api_key:
            raise LLMProviderError(f"{self.provider} API key is missing")

        if not endpoint or not target_model:
            raise LLMProviderError(f"{self.provider} configuration is incomplete")

        # Prepare payload
        if not messages:
            messages = [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": message}
            ]
            
        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", endpoint, json=payload, headers=headers) as response:
                    if response.status_code != 200:
                        # Never log provider response bodies: they can contain private prompts.
                        logger.warning("LLM provider %s returned HTTP %d", self.provider, response.status_code)
                        raise LLMProviderError(f"{self.provider} API returned HTTP {response.status_code}")
                        
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                if data.get("choices") and data["choices"][0].get("delta", {}).get("content"):
                                    yield data["choices"][0]["delta"]["content"]
                            except json.JSONDecodeError:
                                continue
        except LLMProviderError:
            raise
        except (httpx.HTTPError, asyncio.TimeoutError) as exc:
            logger.warning("LLM streaming failed for %s (%s)", self.provider, type(exc).__name__)
            raise LLMProviderError(f"Unable to stream from {self.provider}") from exc
