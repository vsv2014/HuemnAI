"""Deterministic scheduler policy tests without importing production DB connectors."""
import ast
import datetime as dt
from pathlib import Path
from types import SimpleNamespace
import unittest
from typing import Optional


SOURCE = Path(__file__).resolve().parents[1] / "app/services/workflow_scheduler.py"
tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
selected = [
    node for node in tree.body
    if isinstance(node, ast.FunctionDef)
    and node.name in ("_utc_naive", "_next_recurrence", "_is_due")
]
namespace = {
    "datetime": dt.datetime,
    "timedelta": dt.timedelta,
    "timezone": dt.timezone,
    "Optional": Optional,
    "ScheduledTask": SimpleNamespace,
}
class FakeTaskStatus:
    PENDING = "pending"
    FAILED = "failed"
    PROCESSING = "processing"

namespace["TaskStatus"] = FakeTaskStatus
exec(compile(ast.Module(body=selected, type_ignores=[]), str(SOURCE), "exec"), namespace)


class SchedulerPolicyTests(unittest.TestCase):
    def test_aware_timestamp_due(self):
        now = dt.datetime(2026, 11, 13, 12, 0)
        task = SimpleNamespace(
            status="pending",
            scheduled_time=dt.datetime(2026, 11, 13, 11, 30, tzinfo=dt.timezone.utc),
        )
        self.assertTrue(namespace["_is_due"](now, task))

    def test_future_task_not_due(self):
        now = dt.datetime(2026, 11, 13, 12, 0)
        task = SimpleNamespace(status="pending", scheduled_time=now + dt.timedelta(hours=2))
        self.assertFalse(namespace["_is_due"](now, task))

    def test_processing_task_never_due(self):
        now = dt.datetime.utcnow()
        task = SimpleNamespace(status="processing", scheduled_time=now - dt.timedelta(hours=1))
        self.assertFalse(namespace["_is_due"](now, task))

    def test_recurring_rate_advances(self):
        now = dt.datetime(2026, 11, 13, 12, 0)
        task = SimpleNamespace(recurrence="rate(5 minutes)")
        self.assertEqual(namespace["_next_recurrence"](task, now), now + dt.timedelta(minutes=5))

    def test_recurring_daily_uses_utc(self):
        now = dt.datetime(2026, 11, 13, 12, 0)
        task = SimpleNamespace(recurrence="at 08:30")
        self.assertEqual(
            namespace["_next_recurrence"](task, now),
            dt.datetime(2026, 11, 14, 8, 30),
        )

    def test_invalid_recurrence_does_not_loop(self):
        self.assertIsNone(namespace["_next_recurrence"](
            SimpleNamespace(recurrence="rate(0 minutes)"), dt.datetime.utcnow()
        ))

    def test_atomic_claim_and_broker_failure_contract(self):
        code = SOURCE.read_text(encoding="utf-8")
        self.assertIn("ScheduledTask.status == original_status", code)
        self.assertIn("claimed != 1", code)
        self.assertNotIn("loop.run_until_complete(_run())", code)


if __name__ == "__main__":
    unittest.main()
