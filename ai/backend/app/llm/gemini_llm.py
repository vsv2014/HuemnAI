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
    async def stream(self, message: str, messages: Optional[List[Dict[str, str]]] = None, model: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 2000) -> AsyncGenerator[str, None]:
        # Get configuration
        from app.services.config_service import get_llm_config
        config = get_llm_config("gemini")
        
        api_key = None
        config_model = "gemini-pro"
        
        if config and config.get("is_database"):
            api_key = config.get("api_key")
            config_model = config.get("config_data", {}).get("model", config_model)
            
        if not api_key:
            logger.warning("Gemini API key not configured.")
            yield "⚠️ Gemini API key not configured."
            return

        if not GEMINI_AVAILABLE:
            yield "⚠️ Google GenAI library not installed."
            return

        client = genai.Client(api_key=api_key)
        
        target_model = model or config_model
        
        # Convert messages to Gemini format
        formatted_contents = []
        system_instruction = None
        
        if messages:
            for msg in messages:
                role = msg["role"]
                content = msg["content"]
                
                if role == "system":
                    system_instruction = content
                elif role == "user":
                    formatted_contents.append(types.Content(role="user", parts=[types.Part.from_text(text=content)]))
                elif role == "assistant":
                    formatted_contents.append(types.Content(role="model", parts=[types.Part.from_text(text=content)]))
        else:
             formatted_contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))

        try:
            config_args = {}
            if system_instruction:
                 config_args['system_instruction'] = system_instruction
            
            config_args['temperature'] = temperature
            config_args['max_output_tokens'] = max_tokens

            response = client.models.generate_content_stream(
                model=target_model,
                contents=formatted_contents,
                config=types.GenerateContentConfig(**config_args)
            )
            
            for chunk in response:
                if chunk.text:
                    yield chunk.text
                    
        except Exception as e:
            logger.error(f"Gemini error: {e}")
            yield f"Error from Gemini: {str(e)}"
