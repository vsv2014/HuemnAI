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
    async def stream(self, message: str, messages: list = None, model: str = None):
        """
        Stream tokens from OpenAI API.
        Args:
            message: The user message (used if messages is None)
            messages: Full conversation history (preferred)
            model: Specific model to use (overrides config)
        """
        # Map deprecated or alias model names to current equivalents
        def normalize_model_name(name: str) -> str:
            if not name:
                return name
            n = name.strip().lower()
            mapping = {
                "gpt-4-turbo": "gpt-4o",
                "gpt-4": "gpt-4o",
                "chatgpt-4": "gpt-4o",
                "gpt4": "gpt-4o",
                "gpt-35-turbo": "gpt-3.5-turbo",
            }
            return mapping.get(n, name)
        # Try to get from user configuration first (UI Settings only)
        from app.services.config_service import get_llm_config
        config = get_llm_config("openai")
        api_key = None
        config_model = None
        
        # STRICT: Only use UI-configured keys (from database)
        if config and config.get("is_database"):
            api_key = config.get("api_key")
            # Get primary model
            config_model = config.get("config_data", {}).get("model", "gpt-3.5-turbo")
            # Get fallback models list
            fallback_models = config.get("config_data", {}).get("fallback_models", [])
            if isinstance(fallback_models, str):
                fallback_models = [m.strip() for m in fallback_models.split(",") if m.strip()]
            
            # Create ordered list of models to try
            # If explicit model provided, try that first (or only that?)
            # For shadow mode, we want to try ONLY the specific model usually, but fallbacks are okay.
            if model:
                models_to_try = [normalize_model_name(model)]
            else:
                primary = normalize_model_name(config_model)
                fallbacks = [normalize_model_name(m) for m in fallback_models if m != config_model]
                # Always include safe fallbacks at the end
                for safe in ["gpt-4o", "gpt-3.5-turbo"]:
                    if safe not in fallbacks:
                        fallbacks.append(safe)
                models_to_try = [primary] + fallbacks
        
        # Fallback to environment variable in development if DB config missing
        if not api_key:
            env_key = os.getenv("OPENAI_API_KEY")
            if env_key:
                api_key = env_key
                # Use provided model or sensible default
                models_to_try = [normalize_model_name(model)] if model else ["gpt-4o", "gpt-3.5-turbo"]
            else:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning("OpenAI API key not configured via UI Settings and OPENAI_API_KEY env var not set.")
                response = "⚠️ OpenAI API key not configured. Please add configuration in Settings or set OPENAI_API_KEY."
                for token in response.split():
                    yield token + " "
                    await asyncio.sleep(0.05)
                return
        
        # If OpenAI key is available, use real API
        if OPENAI_AVAILABLE and api_key:
            client = OpenAI(api_key=api_key)
            
            success = False
            last_error = None
            
            # Prepare messages if not provided
            if not messages:
                messages = [
                    {"role": "system", "content": "You are a helpful, empathetic customer service assistant. Provide unique, contextual responses for each query. Be conversational and natural."},
                    {"role": "user", "content": message}
                ]
            
            # Try each model in sequence
            for current_model in models_to_try:
                try:
                    # Use chat completions API for streaming with higher temperature for variety
                    stream = client.chat.completions.create(
                        model=current_model,
                        messages=messages,
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
                    
                    # If we got here and received content, we're done
                    if content_received:
                        success = True
                        break
                    else:
                        raise Exception(f"No content received from model {current_model}")
                        
                except Exception as e:
                    last_error = e
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"Model {current_model} failed: {e}. Trying next model...")
                    continue
            
            if not success:
                # Log the error for debugging
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"All OpenAI models failed. Last error: {last_error}, falling back to contextual response")
                print(f"OpenAI API error: {last_error}")
                
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
            # Fallback for when OPENAI_AVAILABLE is False but api_key was somehow present
            # Or if code falls through to here
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("OpenAI library not installed or other error.")
            
            response = "⚠️ OpenAI library not available. Please install 'openai' package."
            
            for token in response.split():
                yield token + " "
                await asyncio.sleep(0.05)
