"""Deterministic bounded document chunking for embedding-based retrieval.

Unlike a fixed 5,000-word chunk, these windows never exceed the configured
character input size. Overlap retains context across chunk boundaries. This
provides a safe baseline; document headings/tables and tokenizer-aware
chunking can replace it after quality evaluation.
"""
from typing import List


def chunk_text(text: str, *, max_chars: int = 5000, overlap_chars: int = 500) -> List[str]:
    if not isinstance(text, str):
        raise TypeError("Document content must be text")
    if not (0 <= overlap_chars < max_chars):
        raise ValueError("Overlap must be >= 0 and smaller than max_chars")
    if max_chars < 32:
        raise ValueError("max_chars must be >= 32")
    if not text.strip():
        return []

    chunks: List[str] = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + max_chars, length)
        if end < length:
            # Prefer a word boundary in the last 40% of the window. If the
            # content contains no spaces (e.g. CJK), use a character boundary.
            boundary = max(text.rfind(" ", start + max_chars // 2, end),
                           text.rfind("\n", start + max_chars // 2, end))
            if boundary > start:
                end = boundary + 1

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == length:
            break

        # Always advance even if overlap is very large. The same text may
        # appear in adjacent chunks, but all source characters are covered.
        start = max(start + 1, end - overlap_chars)

    return chunks
