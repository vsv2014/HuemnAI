"""Deterministic lexical + semantic fusion for authorized RAG chunks.

This is a database-independent ranking layer for the existing JSON-vector
retrieval. It is NOT a pgvector/HNSW index and does not replace source ACLs.
"""
from collections import Counter
import math
import re
from typing import Any, List, Tuple


def tokenize(text: str) -> List[str]:
    return re.findall(r"\w+", (text or "").lower(), flags=re.UNICODE)


def rank_hybrid(
    query: str, candidates: List[Tuple[float, Any]], limit: int = 5
) -> List[Tuple[float, Any, float, float]]:
    """Rank (cosine_score, chunk) with reciprocal-rank fusion.

    Outputs (normalized_rank_score, chunk, cosine_score, bm25_score).
    Only candidates supplied by the caller are considered: callers must
    enforce tenant and model/embedding compatibility before invoking.
    """
    if not 1 <= limit <= 100:
        raise ValueError("limit must be between 1 and 100")
    if not candidates:
        return []

    # De-duplicate without changing stable tie ordering.
    chunks = []
    seen = set()
    for dense, chunk in candidates:
        identity = getattr(chunk, "id", id(chunk))
        if identity in seen:
            continue
        seen.add(identity)
        if not math.isfinite(float(dense)):
            continue
        chunks.append((float(dense), chunk))
    if not chunks:
        return []

    query_tokens = tokenize(query)
    docs = [tokenize(getattr(chunk, "content", "") or "") for _, chunk in chunks]
    docs_counts = [Counter(tokens) for tokens in docs]
    df = Counter()
    for counts in docs_counts:
        df.update(counts.keys())
    count = len(chunks)
    avg_len = sum(len(doc) for doc in docs) / count or 1.0
    bm25 = []
    for tokens, counts in zip(docs, docs_counts):
        score = 0.0
        for term in set(query_tokens):
            freq = counts.get(term, 0)
            if freq:
                idf = math.log(1 + (count - df[term] + 0.5) / (df[term] + 0.5))
                score += idf * (freq * 2.2) / (
                    freq + 1.2 * (0.25 + 0.75 * len(tokens) / avg_len)
                )
        bm25.append(score)

    dense_order = sorted(range(count), key=lambda i: (-chunks[i][0], i))
    lexical_order = sorted(range(count), key=lambda i: (-bm25[i], i))
    dense_rank = {idx: pos + 1 for pos, idx in enumerate(dense_order)}
    lexical_rank = {idx: pos + 1 for pos, idx in enumerate(lexical_order)}
    has_lexical_match = any(score > 0 for score in bm25)
    rrf_scores = []
    for idx in range(count):
        rank_score = 1 / (60 + dense_rank[idx])
        if has_lexical_match and bm25[idx] > 0:
            rank_score += 1 / (60 + lexical_rank[idx])
        rrf_scores.append(rank_score)

    peak = max(rrf_scores)
    order = sorted(range(count), key=lambda i: (-rrf_scores[i], -chunks[i][0], i))
    return [
        (round(rrf_scores[idx] / peak, 5), chunks[idx][1],
         chunks[idx][0], round(bm25[idx], 5))
        for idx in order[:limit]
    ]
