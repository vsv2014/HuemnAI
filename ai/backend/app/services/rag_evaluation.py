"""Offline RAG retrieval metrics for a repeatable golden question set.

This evaluates *retrieval*, not generation quality. Groundedness, citation
accuracy and human preference require additional labeled evaluation layers.

Input per query:
  relevant_ids: known relevant chunk/source identifiers
  retrieved_ids: ordered identifiers returned by the retriever

IDs are opaque strings; never store raw customer questions or documents in
published CI test fixtures without sanitization.
"""
from dataclasses import dataclass
from statistics import mean
from typing import Iterable, Sequence


@dataclass(frozen=True)
class RetrievalScore:
    recall_at_k: float
    precision_at_k: float
    reciprocal_rank_at_k: float
    relevant_count: int
    retrieved_count: int


def score_retrieval(
    relevant_ids: Iterable[str],
    retrieved_ids: Sequence[str],
    *,
    k: int = 10,
) -> RetrievalScore:
    if not isinstance(k, int) or isinstance(k, bool) or k < 1:
        raise ValueError("k must be a positive integer")
    relevant = {str(item) for item in relevant_ids}
    if not relevant:
        raise ValueError("Gold set must contain at least one relevant result")
    ordered = [str(item) for item in retrieved_ids[:k]]
    unique = list(dict.fromkeys(ordered))
    matches = relevant.intersection(unique)
    reciprocal = 0.0
    for index, item in enumerate(ordered, 1):
        if item in relevant:
            reciprocal = 1.0 / index
            break
    return RetrievalScore(
        recall_at_k=len(matches) / len(relevant),
        precision_at_k=len(matches) / len(unique) if unique else 0.0,
        reciprocal_rank_at_k=reciprocal,
        relevant_count=len(relevant),
        retrieved_count=len(unique),
    )


def aggregate_retrieval(scores: Iterable[RetrievalScore]) -> dict:
    values = list(scores)
    if not values:
        raise ValueError("Evaluation needs at least one golden query")
    return {
        "queries": len(values),
        "mean_recall_at_k": round(mean(s.recall_at_k for s in values), 4),
        "mean_precision_at_k": round(mean(s.precision_at_k for s in values), 4),
        "mean_reciprocal_rank_at_k": round(mean(s.reciprocal_rank_at_k for s in values), 4),
    }
