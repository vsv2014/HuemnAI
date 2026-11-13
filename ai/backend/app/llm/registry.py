"""Model provider routing with explicit capabilities and no cross-provider fallback."""
from app.llm.openai_llm import OpenAILLM
from app.llm.azure_llm import AzureLLM
from app.llm.claude_llm import ClaudeLLM
from app.llm.gemini_llm import GeminiLLM
from app.llm.generic_llm import GenericLLM
from app.services.config_service import get_llm_config

ALIASES = {
    "claude": "anthropic",
    "gemini": "google",
    "google_gemini": "google",
    "azure_openai": "azure",
}
NATIVE_PROVIDERS = {
    "openai": OpenAILLM,
    "azure": AzureLLM,
    "anthropic": ClaudeLLM,
    "google": GeminiLLM,
}
OPENAI_COMPATIBLE_PROVIDERS = frozenset({"groq", "together", "ollama", "mistral"})


def get_llm(name: str = None):
    """Return a provider-specific adapter or raise an actionable configuration error.

    Instantiate per call so no cached adapter can accidentally retain another
    user's BYOK credentials or request state.
    """
    if not name:
        return get_available_llm()
    canonical = ALIASES.get(name.lower().strip(), name.lower().strip())
    if canonical in NATIVE_PROVIDERS:
        return NATIVE_PROVIDERS[canonical]()
    if canonical in OPENAI_COMPATIBLE_PROVIDERS:
        return GenericLLM(provider=canonical)
    raise ValueError(f"Unsupported LLM provider: {name}")


def get_available_llm():
    """Resolve the current tenant's configured default; never select a random key."""
    config = get_llm_config()
    if not config:
        raise RuntimeError("No authorized AI model provider configured. Open Settings to add one.")
    provider = str(config.get("provider", "")).lower()
    if not config.get("api_key") and provider != "ollama":
        raise RuntimeError(f"Provider {provider} has no usable credentials")
    return get_llm(provider)
