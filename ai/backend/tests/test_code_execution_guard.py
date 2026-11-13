"""Code runner must refuse arbitrary Python until OS-level isolation exists."""
import asyncio
import unittest
from app.orchestrator.sandbox.runner import SandboxRunner


class UnisolatedCodeExecutionTests(unittest.TestCase):
    def test_runner_fails_closed(self):
        result = asyncio.run(SandboxRunner("test").run_python(
            "raise RuntimeError('must not execute')"
        ))
        self.assertEqual(result["status"], "disabled")
        self.assertIn("isolated runner", result["error"])

    def test_runner_does_not_launch_host_python(self):
        import inspect
        source = inspect.getsource(SandboxRunner.run_python)
        self.assertNotIn("create_subprocess_exec", source)
        self.assertNotIn("subprocess.run", source)


if __name__ == "__main__":
    unittest.main()
