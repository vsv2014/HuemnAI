import asyncio
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
    async def stream(self, message: str):
        """
        Stream tokens from OpenAI API if key is available, otherwise return mock response.
        """
        # Try to get from user configuration first (UI Settings only)
        from app.services.config_service import get_llm_config
        config = get_llm_config("openai")
        api_key = None
        model = None
        
        # STRICT: Only use UI-configured keys (from database)
        if config and config.get("is_database"):
            api_key = config.get("api_key")
            model = config.get("config_data", {}).get("model", "gpt-3.5-turbo")
        
        # NO FALLBACK to environment variables - require UI configuration
        if not api_key:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("OpenAI API key not configured via UI Settings. User must configure via Settings page.")
            # Return configuration error immediately
            response = "⚠️ OpenAI API key not configured. Please go to Settings and add your LLM provider configuration to use this feature."
            for token in response.split():
                yield token + " "
                await asyncio.sleep(0.05)
            return
        
        # If OpenAI key is available, use real API
        if OPENAI_AVAILABLE and api_key:
            try:
                client = OpenAI(api_key=api_key)
                
                # Use chat completions API for streaming with higher temperature for variety
                stream = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": "You are a helpful, empathetic customer service assistant. Provide unique, contextual responses for each query. Be conversational and natural."},
                        {"role": "user", "content": message}
                    ],
                    stream=True,
                    temperature=0.8,  # Higher temperature for more variety
                    max_tokens=500,
                )
                
                # Stream tokens as they arrive
                content_received = False
                for chunk in stream:
                    if chunk.choices and len(chunk.choices) > 0:
                        delta = chunk.choices[0].delta
                        if delta and delta.content:
                            content_received = True
                            yield delta.content
                
                # If no content received, something went wrong
                if not content_received:
                    raise Exception("No content received from OpenAI API")
                        
            except Exception as e:
                # Log the error for debugging
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"OpenAI API error: {e}, falling back to contextual response")
                print(f"OpenAI API error: {e}")
                
                # Fall back to smart contextual response instead of generic
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
            # No API key configured - return configuration message
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("OpenAI API key not configured. User should configure via Settings page.")
            
            response = "⚠️ OpenAI API key not configured. Please go to Settings and add your LLM provider configuration to use this feature. Without an API key, I cannot generate AI responses."
            
            # Stream the response token by token
            for token in response.split():
                yield token + " "
                await asyncio.sleep(0.05)
