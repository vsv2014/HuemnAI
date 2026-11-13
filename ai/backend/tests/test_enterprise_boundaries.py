"""Source-level regressions for high-risk platform boundaries.

These are fast guardrails, not substitutes for authenticated HTTP tests, provider
integration checks, visual browser tests, or actual worker restart tests.
"""
import ast
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT.parent / "frontend"


def source(relative):
    return (ROOT / relative).read_text(encoding="utf-8")


class EnterpriseBoundaryContractTests(unittest.TestCase):
    def test_critical_python_sources_are_syntactically_valid(self):
        for relative in (
            "app/api/agents.py",
            "app/api/auth.py",
            "app/api/agent_builder.py",
            "app/api/workflow.py",
            "app/api/endpoints/trace.py",
            "app/api/endpoints/evaluation.py",
            "app/services/config_service.py",
            "app/llm/registry.py",
            "app/llm/openai_llm.py",
            "app/llm/claude_llm.py",
            "app/llm/gemini_llm.py",
            "app/llm/generic_llm.py",
            "app/workers/scheduler.py",
        ):
            with self.subTest(path=relative):
                ast.parse(source(relative), filename=relative)

    def test_graph_has_only_one_primary_generate_flow_route(self):
        code = source("app/api/agents.py")
        self.assertEqual(code.count('@router.post("/generate-flow")'), 1)
        self.assertIn('@router.post("/generate-flow/simple"', code)

    def test_no_unisolated_python_exec(self):
        self.assertNotIn("exec(request.code,", source("app/api/agent_builder.py"))
        self.assertIn("status_code=503", source("app/api/agent_builder.py"))
        self.assertNotIn("create_subprocess_exec", source("app/orchestrator/sandbox/runner.py"))

    def test_trace_evaluation_and_workflows_have_owner_controls(self):
        self.assertIn("Agent.user_id == current_user.id", source("app/api/endpoints/trace.py"))
        self.assertIn("Agent.user_id == current_user.id", source("app/api/endpoints/evaluation.py"))
        self.assertIn("ScheduledTask.created_by == user.id", source("app/api/workflow.py"))

    def test_llm_byok_queries_are_tenant_bound(self):
        config = source("app/services/config_service.py")
        self.assertIn("APIConfig.user_id ==", config)
        self.assertIn("get_provider_user_id()", config)
        self.assertIn("bind_provider_user(user.id)", source("app/api/auth.py"))
        self.assertIn("reset_provider_user(principal_token)", source("app/main.py"))

    def test_runtime_never_creates_fake_openai_response(self):
        code = source("app/llm/openai_llm.py")
        self.assertIn("AsyncOpenAI", code)
        self.assertNotIn("falling back to contextual response", code)
        self.assertNotIn('yield "⚠️', code)
        self.assertIn("raise RuntimeError", code)

    def test_playground_is_not_a_mock(self):
        code = (FRONTEND / "app/agents/[id]/testing/playground/page.tsx").read_text(encoding="utf-8")
        self.assertIn("processAgentMessage(", code)
        self.assertNotIn("setTimeout(", code)
        self.assertNotIn("This is a test response.", code)

    def test_builder_scroll_is_not_globally_disabled(self):
        css = (FRONTEND / "styles/globals.css").read_text(encoding="utf-8")
        self.assertNotIn("html:has([data-agent-builder]) * {", css)
        self.assertIn("prefers-reduced-motion", css)


if __name__ == "__main__":
    unittest.main()
