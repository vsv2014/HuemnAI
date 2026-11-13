from typing import List
import os

try:
    import openai
except Exception:
    openai = None


class EmbeddingError(RuntimeError):
    """Embedding generation failed; do not substitute incompatible synthetic vectors."""


class EmbeddingConfigurationError(EmbeddingError):
    """No usable embedding provider is configured."""


class EmbeddingProviderError(EmbeddingError):
    """A configured embedding provider could not return a valid vector."""


def get_embedding(text: str) -> List[float]:
    """Generate a real model embedding, or fail explicitly.

    Query and document embeddings must originate from compatible embedding-model
    configurations. Existing 64-dimensional synthetic vectors need migration.
    """
    import math
    import logging
    log = logging.getLogger(__name__)

    if not text or not text.strip():
        raise ValueError("Cannot embed empty text")
    if openai is None:
        raise EmbeddingConfigurationError("OpenAI embedding SDK is not installed")

    from app.services.config_service import get_llm_config
    config = get_llm_config("openai") or {}
    api_key = config.get("api_key") or os.getenv("OPENAI_API_KEY")
    model = (config.get("config_data") or {}).get("embedding_model") or os.getenv(
        "OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"
    )
    if not api_key:
        raise EmbeddingConfigurationError("Embedding provider credentials are not configured")

    try:
        from openai import OpenAI
        response = OpenAI(api_key=api_key, timeout=20).embeddings.create(
            input=text[:8000], model=model
        )
        vector = list(response.data[0].embedding)
    except Exception as exc:
        log.warning("Embedding generation failed for model %s (%s)", model, type(exc).__name__)
        raise EmbeddingProviderError("Embedding provider request failed") from exc

    if not vector or any(not math.isfinite(value) for value in vector):
        raise EmbeddingProviderError("Embedding provider returned an invalid vector")
    return vector


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """True cosine similarity; disallow truncation or zero-norm vectors."""
    import math

    if not a or not b or len(a) != len(b):
        raise ValueError("Embedding vectors are empty or their dimensions differ")
    if not all(math.isfinite(x) for x in a) or not all(math.isfinite(x) for x in b):
        raise ValueError("Embedding contains non-finite values")
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        raise ValueError("Cannot compare zero-length embedding vectors")
    return sum(x * y for x, y in zip(a, b)) / (norm_a * norm_b)
