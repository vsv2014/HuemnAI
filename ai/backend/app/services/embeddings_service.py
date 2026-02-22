from typing import List
import os

try:
    import openai
except Exception:
    openai = None


def get_embedding(text: str) -> List[float]:
    """Return an embedding vector for text using OpenAI embeddings if available, else a simple hash-based vector."""
    text = text[:8000] if text else ""
    # Try to get from user configuration first (OpenAI for embeddings)
    from app.services.config_service import get_llm_config
    config = get_llm_config("openai")  # Embeddings require OpenAI
    api_key = config.get("api_key") if config else None
    embedding_model = config.get("config_data", {}).get("embedding_model", "text-embedding-3-small") if config else None
    
    # Fallback to environment (deprecated - use UI Settings instead)
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            # No key configured - will use fallback embeddings
            pass
    if not embedding_model:
        embedding_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    
    # Prefer OpenAI if configured
    if openai and api_key:
        try:
            # Try new OpenAI API (v1.0+)
            from openai import OpenAI
            client = OpenAI(api_key=api_key, timeout=20)
            model = embedding_model
            resp = client.embeddings.create(input=text, model=model)
            return resp.data[0].embedding
        except (ImportError, AttributeError):
            # Fallback to old API format
            try:
                openai.api_key = os.getenv("OPENAI_API_KEY")
                model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
                resp = openai.Embedding.create(input=text, model=model, request_timeout=20)
                return resp["data"][0]["embedding"]
            except Exception as e:
                logger = __import__("logging").getLogger(__name__)
                logger.warning(f"OpenAI embedding failed: {e}, using fallback")

    # Fallback: naive embedding (character-level hashed buckets)
    vec_size = 64
    vec = [0.0] * vec_size
    for i, ch in enumerate(text[:512]):
        vec[i % vec_size] += ord(ch) / 255.0
    # normalize
    norm = sum(x*x for x in vec) ** 0.5 or 1.0
    return [x / norm for x in vec]


def cosine_similarity(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))
