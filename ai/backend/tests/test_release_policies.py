"""Source contracts for safe enterprise ownership and version-management flows.

These contracts catch regressions quickly; they are not database integration,
browser UX or version-pinned runtime tests.
"""
import ast
from pathlib import Path
import unittest

BACKEND = Path(__file__).resolve().parents[1]
FRONTEND = BACKEND.parent / "frontend"


def read_backend(path):
    return (BACKEND / path).read_text(encoding="utf-8")


def function_in(path, name):
    tree = ast.parse(read_backend(path))
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return ast.unparse(node)
    raise AssertionError(f"Missing function: {name}")


class EnterpriseReleaseSafetyTests(unittest.TestCase):
    def test_all_enterprise_settings_require_owner(self):
        code = read_backend("app/api/enterprise.py")
        self.assertIn("dependencies=[Depends(require_owned_agent)]", code)
        owner_check = function_in("app/api/enterprise.py", "require_owned_agent")
        self.assertIn("Agent.user_id == current_user.id", owner_check)

    def test_tool_configuration_is_authenticated_and_admin_write(self):
        code = read_backend("app/api/tools.py")
        self.assertIn("APIRouter(dependencies=[Depends(get_current_user)])", code)
        admin = function_in("app/api/tools.py", "set_tool_operation_mode")
        self.assertIn("check_permission(Permission.MANAGE_USERS)", admin)

    def test_byok_needs_owner_id_before_decrypt(self):
        code = read_backend("app/services/llm/provider_service.py")
        self.assertIn("owner_user_id", code)
        self.assertIn("Agent.user_id == owner_user_id", code)

    def test_release_snapshots_include_graph(self):
        snapshot = function_in("app/services/agent_versions.py", "snapshot_agent")
        for component in ("graph_validation", "validate_graph", "nodes", "connections", "entry_node_id"):
            with self.subTest(component=component):
                self.assertIn(component, snapshot)
        release = function_in("app/api/enterprise.py", "create_version")
        self.assertIn("snapshot_agent", release)
        self.assertIn("Version number already exists", release)

    def test_stale_candidate_cannot_be_published(self):
        publish = function_in("app/api/enterprise.py", "publish_version")
        self.assertIn("same_revision", publish)
        self.assertIn("status_code=409", publish)
        self.assertIn("runtime_version_pinning", publish)

    def test_mock_publishing_removed_from_ui(self):
        publish_ui = (FRONTEND / "app/agents/[id]/deploy/publish/page.tsx").read_text(encoding="utf-8")
        versions_ui = (FRONTEND / "app/agents/[id]/deploy/versions/page.tsx").read_text(encoding="utf-8")
        self.assertIn("createVersion(", publish_ui)
        self.assertIn("publishVersion(", publish_ui)
        self.assertNotIn('alert("Publishing agent...")', publish_ui)
        self.assertNotIn("Fallback to mock data", versions_ui)
        self.assertNotIn(">Rollback</button>", versions_ui)

    def test_unimplemented_tool_cannot_look_successful(self):
        registry = read_backend("app/core/tool_registry.py")
        self.assertNotIn("handler=lambda payload: None", registry)
        connector = read_backend("app/core/connector_manager.py")
        self.assertNotIn('register_tool(tool_name, lambda payload, n=name: None', connector)
        self.assertIn("USE_REAL_CONNECTORS", connector)


if __name__ == "__main__":
    unittest.main()
