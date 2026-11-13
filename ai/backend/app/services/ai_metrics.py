"""Low-cardinality AI pipeline metrics.

Labels intentionally exclude prompts, document IDs, user IDs and arbitrary
model names. Existing Prometheus instrumentator exposes these counters/histograms.
"""
from contextlib import contextmanager
from time import perf_counter

from prometheus_client import Counter, Histogram

AI_STAGE_COUNT = Counter(
    "huemn_ai_stage_total",
    "AI pipeline stage attempts",
    ("stage", "outcome"),
)
AI_STAGE_LATENCY = Histogram(
    "huemn_ai_stage_duration_seconds",
    "AI pipeline latency by stage",
    ("stage",),
    buckets=(.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 30, 60),
)
KNOWN_STAGES = frozenset({"embedding", "retrieval_scoring", "inference", "tool_execution"})


@contextmanager
def measure_ai_stage(stage: str):
    if stage not in KNOWN_STAGES:
        raise ValueError("Unknown AI instrumentation stage")
    start = perf_counter()
    outcome = "ok"
    try:
        yield
    except BaseException:
        outcome = "error"
        raise
    finally:
        AI_STAGE_COUNT.labels(stage=stage, outcome=outcome).inc()
        AI_STAGE_LATENCY.labels(stage=stage).observe(perf_counter() - start)
