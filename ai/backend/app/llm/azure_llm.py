import asyncio
from app.llm.base import BaseLLM
from app.core.config import settings
import os

# Try to import Azure OpenAI SDK
try:
    from openai import AzureOpenAI
    AZURE_AVAILABLE = True
except ImportError:
    AZURE_AVAILABLE = False
    AzureOpenAI = None


class AzureLLM(BaseLLM):
    async def stream(self, message: str, messages: list = None, model: str = None, temperature: float = 0.7, max_tokens: int = 2000):
        """
        Stream tokens from Azure OpenAI API if configured, otherwise return contextual response.
        """
        # Try to get from user configuration first (UI Settings only)
        from app.services.config_service import get_llm_config
        config = get_llm_config("azure")
        
        endpoint = None
        api_key = None
        api_version = None
        deployment_name = None
        
        # STRICT: Only use UI-configured keys (from database)
        if config and config.get("is_database"):
            endpoint = config.get("config_data", {}).get("endpoint")
            api_key = config.get("api_key")
            api_version = config.get("config_data", {}).get("api_version", "2024-02-15-preview")
            deployment_name = config.get("config_data", {}).get("deployment_name", "gpt-35-turbo")
        
        # NO FALLBACK to environment variables - require UI configuration
        if not api_key or not endpoint:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("Azure OpenAI API key not configured via UI Settings. User must configure via Settings page.")
            # Return configuration error immediately
            response = "⚠️ Azure OpenAI API key not configured. Please go to Settings and add your LLM provider configuration to use this feature."
            for token in response.split():
                yield token + " "
                await asyncio.sleep(0.05)
            return
        
        # If Azure OpenAI is configured, use real API
        if AZURE_AVAILABLE and endpoint and api_key:
            try:
                client = AzureOpenAI(
                    api_key=api_key,
                    api_version=api_version,
                    azure_endpoint=endpoint
                )
                
                # Prepare messages if not provided
                if not messages:
                    messages = [
                        {"role": "system", "content": "You are a helpful assistant."},
                        {"role": "user", "content": message}
                    ]
                
                # Use chat completions API for streaming
                stream = client.chat.completions.create(
                    model=deployment_name,
                    messages=messages,
                    stream=True,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                
                # Stream tokens as they arrive
                content_received = False
                for chunk in stream:
                    if chunk.choices and len(chunk.choices) > 0:
                        delta = chunk.choices[0].delta
                        if delta and delta.content:
                            content_received = True
                            yield delta.content
                
                if not content_received:
                    raise Exception("No content received from Azure OpenAI API")
                        
            except Exception as e:
                # Log the error for debugging
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Azure OpenAI API error: {e}, falling back to contextual response")
                print(f"Azure OpenAI API error: {e}")
                
                # Fall back to smart contextual response
                message_lower = message.lower()
                if "login" in message_lower or "password" in message_lower:
                    response = f"I understand you're having login issues. Let me help you troubleshoot this step by step."
                elif "payment" in message_lower or "billing" in message_lower:
                    response = f"I can help with your payment or billing question. Let me look into this for you."
                else:
                    response = f"I understand your concern. Let me help you with that."
                
                for token in response.split():
                    yield token + " "
                    await asyncio.sleep(0.05)
        else:
            # No Azure key configured - return configuration message
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("Azure OpenAI API key not configured. User should configure via Settings page.")
            
            response = "⚠️ Azure OpenAI API key not configured. Please go to Settings and add your LLM provider configuration to use this feature. Without an API key, I cannot generate AI responses."
            
            # Stream the response token by token
            for token in response.split():
                yield token + " "
                await asyncio.sleep(0.05)
