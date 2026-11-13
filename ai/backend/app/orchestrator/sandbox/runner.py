"""Security boundary for user-supplied Python execution.

Do not run untrusted Python inside the API/Celery process. A temporary directory,
subprocess timeout, and working-directory change do not isolate imports,
environment variables, network access, or host filesystem access.

Re-enable this feature only with a separately deployed, unprivileged isolated
executor with resource, network, filesystem and credential boundaries.
"""
from typing import Any, Dict


class SandboxRunner:
    def __init__(self, session_id: str):
        self.session_id = session_id

    async def run_python(self, code: str, timeout: int = 20) -> Dict[str, Any]:
        """Fail closed; callers must not dispatch generated code to local Python."""
        return {
            "status": "disabled",
            "error": "Untrusted Python execution is disabled until an isolated runner is deployed.",
        }
