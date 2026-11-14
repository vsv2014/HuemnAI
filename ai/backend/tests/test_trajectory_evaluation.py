"""Deterministic milestone and forbidden-path evaluation tests."""
import unittest
from app.services.trajectory_evaluation import score_trajectory


class TrajectoryEvaluationTests(unittest.TestCase):
    def test_ordered_milestones(self):
        trace = [
            {"node_type": "START", "status": "success"},
            {"node_type": "LLM", "status": "success"},
            {"node_type": "TOOL", "status": "success"},
            {"node_type": "END", "status": "success"},
        ]
        result = score_trajectory(trace, ["start", "tool", "end"])
        self.assertTrue(result["passed"])
        self.assertEqual(result["matched_milestones"], 3)

    def test_wrong_order_fails(self):
        trace = [{"node_type": "TOOL"}, {"node_type": "START"}]
        self.assertFalse(score_trajectory(trace, ["start", "tool"])["passed"])

    def test_forbidden_tool_fails(self):
        trace = [{"node_type": "START"}, {"node_type": "PAYMENT"}]
        result = score_trajectory(trace, ["start"], ["payment"])
        self.assertFalse(result["passed"])
        self.assertEqual(result["forbidden_hits"], 1)

    def test_error_budget(self):
        trace = [{"node_type": "LLM", "status": "error"}]
        self.assertFalse(score_trajectory(trace, ["llm"])["passed"])
        self.assertTrue(score_trajectory(trace, ["llm"], max_error_steps=1)["passed"])

    def test_malformed_events_ignored(self):
        result = score_trajectory([None, "text", {"node_type": "start"}], ["start"])
        self.assertTrue(result["passed"])
        self.assertEqual(result["total_steps"], 1)

    def test_limits_checked(self):
        with self.assertRaises(ValueError):
            score_trajectory([], ["llm"], max_error_steps=-1)
        with self.assertRaises(ValueError):
            score_trajectory([], ["llm"] * 101)


if __name__ == "__main__":
    unittest.main()
