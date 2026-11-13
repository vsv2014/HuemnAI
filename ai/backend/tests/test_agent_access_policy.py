"""Static regression gates for agent management authorization.

These checks parse the route module without importing optional runtime dependencies.
HTTP-level two-account tests are required before deployment.
"""
import ast
from pathlib import Path
import unittest


SOURCE = Path(__file__).resolve().parents[1] / "app" / "api" / "agents.py"
ROUTES = {
    node.name: node
    for node in ast.parse(SOURCE.read_text(encoding="utf-8")).body
    if isinstance(node, ast.AsyncFunctionDef)
}


def required_auth(name):
    function = ROUTES[name]
    names = [arg.arg for arg in function.args.args]
    if "current_user" not in names:
        return False
    # Align trailing defaults to their positional argument names.
    defaults = function.args.defaults
    default_names = names[-len(defaults):] if defaults else []
    default_map = dict(zip(default_names, defaults))
    dependency = default_map.get("current_user")
    return (
        isinstance(dependency, ast.Call)
        and isinstance(dependency.func, ast.Name)
        and dependency.func.id == "Depends"
        and len(dependency.args) == 1
        and isinstance(dependency.args[0], ast.Name)
        and dependency.args[0].id == "get_current_user"
    )


class AgentAuthorizationContractTests(unittest.TestCase):
    def test_private_resource_routes_require_identity(self):
        names = [
            "create_agent", "list_agents", "get_agent", "update_agent", "delete_agent",
            "create_node", "update_node", "delete_node",
            "create_connection", "update_connection", "delete_connection",
            "generate_flow", "generate_flow_from_prompt",
            "get_conversation", "get_conversation_trace",
            "get_agent_integrations", "create_agent_integration",
            "delete_agent_integration", "get_available_agents_for_integration",
            "export_agent", "import_agent", "add_conversation_message"
        ]
        for name in names:
            with self.subTest(route=name):
                self.assertTrue(required_auth(name), name)

    def test_new_agents_are_bound_to_creator(self):
        for name in ("create_agent", "import_agent"):
            with self.subTest(route=name):
                code = ast.unparse(ROUTES[name])
                self.assertIn("user_id=current_user.id", code)

    def test_private_execution_checks_public_flag_and_owner(self):
        code = ast.unparse(ROUTES["process_message"])
        self.assertIn("agent.is_public", code)
        self.assertIn("agent.user_id != current_user.id", code)

    def test_owner_lookup_filters_both_resource_and_user(self):
        helpers = {
            node.name: node
            for node in ast.parse(SOURCE.read_text(encoding="utf-8")).body
            if isinstance(node, ast.FunctionDef)
        }
        code = ast.unparse(helpers["_get_owned_agent"])
        self.assertIn("Agent.user_id == user.id", code)
        self.assertIn("Agent.id == agent_id", code)


if __name__ == "__main__":
    unittest.main()
