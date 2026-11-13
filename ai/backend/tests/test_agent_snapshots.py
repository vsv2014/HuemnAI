"""Snapshot correctness, secret redaction and revision comparison."""
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock
from app.services.agent_versions import safe_snapshot, same_revision, snapshot_agent


class AgentSnapshotTests(unittest.TestCase):
    def test_redacts_nested_secrets_without_mutating_input(self):
        original = {
            "api_key": "sk-secret",
            "provider": "openai",
            "nested": [{"authorization": "Bearer another-secret", "token_limit": 4096}],
            "apiKey": "CAMEL_CASE_SECRET",
            "client-secret": "HYPHEN_SECRET",
        }
        cleaned = safe_snapshot(original)
        self.assertEqual(cleaned["api_key"], "[REDACTED]")
        self.assertEqual(cleaned["apiKey"], "[REDACTED]")
        self.assertEqual(cleaned["client-secret"], "[REDACTED]")
        self.assertEqual(cleaned["nested"][0]["authorization"], "[REDACTED]")
        self.assertEqual(cleaned["nested"][0]["token_limit"], 4096)
        self.assertEqual(original["api_key"], "sk-secret")

    def test_snapshot_contains_graph_and_scrubs_node_config(self):
        db = MagicMock()
        node = SimpleNamespace(
            id=10, node_type=SimpleNamespace(value="start"), name="Start",
            label="Start", config={"api_key": "SECRET", "model": "configured"},
            position_x=32, position_y=40, timeout=10, retry_count=0,
            error_handling={},
        )
        edge = SimpleNamespace(
            id=3, source_node_id=10, target_node_id=10,
            condition={}, priority=1, label="loop",
        )
        db.query.return_value.filter.return_value.order_by.return_value.all.side_effect = [
            [node], [edge]
        ]
        agent = SimpleNamespace(
            id=5, name="Demo", description="Test",
            agent_type=SimpleNamespace(value="chatbot"),
            system_prompt="Helpful assistant", welcome_message="Hello",
            fallback_message="Try again", settings={"password": "hidden"},
            entry_node_id=10,
        )
        record = snapshot_agent(db, agent)
        self.assertEqual(record["schema_version"], 1)
        self.assertEqual(record["nodes"][0]["config"]["api_key"], "[REDACTED]")
        self.assertEqual(record["agent"]["settings"]["password"], "[REDACTED]")
        self.assertEqual(record["connections"][0]["source"], 10)
        self.assertTrue(same_revision(record, record))
        self.assertFalse(same_revision(record, dict(record, schema_version=2)))

    def test_invalid_graph_fails_before_snapshot(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.side_effect = [
            [], []
        ]
        agent = SimpleNamespace(id=5, entry_node_id=None)
        with self.assertRaises(ValueError):
            snapshot_agent(db, agent)


if __name__ == "__main__":
    unittest.main()
