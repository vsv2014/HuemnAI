"""Graph builder structural lint checks (no provider or database required)."""
import unittest
from app.services.graph_validation import validate_graph


class GraphValidationTests(unittest.TestCase):
    def test_valid_linear_graph(self):
        report = validate_graph([1, 2, 3], [(1, 2), (2, 3)], 1)
        self.assertTrue(report["valid"])
        self.assertEqual(report["node_count"], 3)
        self.assertEqual(report["connection_count"], 2)
        self.assertEqual(report["errors"], [])
        self.assertEqual(report["warnings"], [])

    def test_no_entry_fails(self):
        report = validate_graph([1, 2], [(1, 2)], None)
        self.assertFalse(report["valid"])
        self.assertTrue(any(x["code"] == "missing_entry" for x in report["errors"]))

    def test_invalid_entry_fails(self):
        report = validate_graph([1], [], 100)
        self.assertFalse(report["valid"])
        self.assertTrue(any(x["code"] == "invalid_entry" for x in report["errors"]))

    def test_dangling_connection_fails(self):
        report = validate_graph([1, 2], [(1, 3)], 1)
        self.assertFalse(report["valid"])
        self.assertTrue(any(x["code"] == "dangling_connection" for x in report["errors"]))

    def test_unreachable_node_warns(self):
        report = validate_graph([1, 2, 3], [(1, 2)], 1)
        self.assertTrue(report["valid"])
        self.assertTrue(any(x["code"] == "unreachable_node" and x["node"] == 3 for x in report["warnings"]))

    def test_cycle_warns_without_blocking(self):
        report = validate_graph([1, 2, 3], [(1, 2), (2, 3), (3, 1)], 1)
        self.assertTrue(report["valid"])
        self.assertTrue(any(x["code"] == "cycle" for x in report["warnings"]))

    def test_self_loop_warns(self):
        report = validate_graph([1], [(1, 1)], 1)
        self.assertTrue(report["valid"])
        self.assertTrue(any(x["code"] == "self_loop" for x in report["warnings"]))

    def test_empty_graph_fails(self):
        report = validate_graph([], [], None)
        self.assertFalse(report["valid"])


if __name__ == "__main__":
    unittest.main()
