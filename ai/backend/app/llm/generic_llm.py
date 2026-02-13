
import os
import json
import asyncio
import httpx
from typing import List, Dict, Any, Optional, AsyncGenerator
from app.llm.base import BaseLLM
import logging

logger = logging.getLogger(__name__)

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
        max_tokens: int = 4096
    ) -> AsyncGenerator[str, None]:
        from app.services.config_service import get_llm_config
        config = get_llm_config(self.provider)
        
        if not config or not config.get("is_database"):
            logger.warning(f"{self.provider} config not found in database.")
            yield f"⚠️ {self.provider} is not configured. Please add configuration in Settings."
            return

        api_key = config.get("api_key")
        config_data = config.get("config_data", {})
        
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
        
        if not endpoint or not target_model:
            yield f"⚠️ {self.provider} configuration is incomplete (missing endpoint or model)."
            return

        # Prepare payload
        if not messages:
            messages = [{"role": "user", "content": message}]
            
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
                        error_text = await response.aread()
                        logger.error(f"{self.provider} API error: {response.status_code} - {error_text.decode()}")
                        yield f"⚠️ {self.provider} API Error: {response.status_code}"
                        return
                        
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
        except Exception as e:
            logger.error(f"Error in {self.provider} stream: {str(e)}")
            yield f"⚠️ Connection Error: {str(e)}"

    async def generate(
        self,
        message: str,
        messages: Optional[List[Dict[str, str]]] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        tokens = []
        async for token in self.stream(message, messages, model, temperature, max_tokens):
            if not token.startswith("⚠️"):
                tokens.append(token)
        return "".join(tokens)
