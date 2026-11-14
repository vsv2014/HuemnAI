"""Fast offline regression contracts for runtime error reporting and trace state.

These tests intentionally parse route source without importing production
database, Redis or provider SDK modules. HTTP and e2e tests are still required.
"""
import ast
from pathlib import Path
import unittest

BASE = Path(__file__).resolve().parents[1] / "app"


def source_function(file: Path, name: str) -> str:
    tree = ast.parse(file.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return ast.unparse(node)
    raise AssertionError("Missing function " + name)


class AgentAndTraceSafetyTests(unittest.TestCase):
    def test_agent_execution_errors_have_public_error_flag(self):
        content = source_function(BASE / "api" / "agents.py", "process_message")
        self.assertIn("'error': 'Agent execution failed. Please retry.'", content)
        self.assertIn("'error_code': 'agent_execution_failed'", content)

    def test_agent_errors_do_not_include_server_tracebacks(self):
        content = source_function(BASE / "api" / "agents.py", "process_message")
        self.assertNotIn("error_traceback", content)
        self.assertNotIn("traceback.format_exc", content)

    def test_trace_status_does_not_access_missing_orm_property(self):
        content = source_function(BASE / "api" / "endpoints" / "trace.py", "get_conversation_trace")
        self.assertNotIn("conversation.status", content)
        self.assertIn("conversation.is_active", content)


if __name__ == "__main__":
    unittest.main()
