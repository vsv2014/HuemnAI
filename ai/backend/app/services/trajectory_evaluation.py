"""Deterministic trajectory evaluation for persisted agent execution traces.

The result measures observed node-type milestones and failures. It is NOT an
LLM judge or a claim that the final answer was grounded, correct or safe.
"""
from typing import Any, Dict, Iterable, List


def score_trajectory(
    trace: Iterable[Dict[str, Any]],
    required_sequence: List[str],
    forbidden_types: List[str] | None = None,
    max_error_steps: int = 0,
) -> Dict[str, Any]:
    if len(required_sequence) > 100 or len(forbidden_types or []) > 100:
        raise ValueError("Too many trajectory constraints")
    if max_error_steps < 0:
        raise ValueError("max_error_steps must be nonnegative")

    expected = [str(item).strip().lower() for item in required_sequence]
    forbidden = {str(item).strip().lower() for item in (forbidden_types or [])}
    steps = [
        event for event in trace
        if isinstance(event, dict)
    ]
    types = [str(event.get("node_type") or "").strip().lower() for event in steps]
    statuses = [str(event.get("status") or "").strip().lower() for event in steps]
    index = 0
    for node_type in types:
        if index < len(expected) and node_type == expected[index]:
            index += 1

    forbidden_hits = sum(item in forbidden for item in types)
    errors = sum(
        event_type == "error" or status in {"error", "failed"}
        for event_type, status in zip(types, statuses)
    )
    return {
        "passed": index == len(expected) and forbidden_hits == 0 and errors <= max_error_steps,
        "matched_milestones": index,
        "required_milestones": len(expected),
        "milestone_coverage": round(index / len(expected), 4) if expected else 1.0,
        "forbidden_hits": forbidden_hits,
        "error_steps": errors,
        "total_steps": len(steps),
        "limitations": [
            "Node-type sequence checks do not measure answer correctness.",
            "Persisted trace completeness depends on the agent runtime.",
        ],
    }
