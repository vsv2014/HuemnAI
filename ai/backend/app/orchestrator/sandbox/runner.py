import asyncio
import tempfile
import os
from typing import Dict, Any, Optional
from app.services.socket_manager import manager


class SandboxRunner:
    def __init__(self, session_id: str):
        self.session_id = session_id

    async def _stream_output(self, stream, tag: str):
        while True:
            line = await stream.readline()
            if not line:
                break
            try:
                await manager.send_json({"event": "console", "data": {"tag": tag, "line": line.decode(errors="ignore")}}, client_id=self.session_id)
            except Exception:
                pass

    async def run_python(self, code: str, timeout: int = 20) -> Dict[str, Any]:
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "main.py")
            with open(path, "w", encoding="utf-8") as f:
                f.write(code)
            proc = await asyncio.create_subprocess_exec(
                "python", path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=tmpdir
            )
            await asyncio.wait([
                self._stream_output(proc.stdout, "stdout"),
                self._stream_output(proc.stderr, "stderr"),
            ], timeout=timeout)
            try:
                await asyncio.wait_for(proc.wait(), timeout=timeout)
            except asyncio.TimeoutError:
                proc.kill()
                return {"status": "timeout"}
            return {"status": "done", "returncode": proc.returncode}
