import json
import uuid
from typing import Dict, Any, Optional
from app.core.redis import redis_client
from app.db.session import SessionLocal
from app.db.models.audit import AuditLog


class MemoryStore:
    _fallback: Dict[str, Any] = {}
    @staticmethod
    def new_session() -> str:
        return str(uuid.uuid4())

    @staticmethod
    async def save_session(session_id: str, data: Dict[str, Any]):
        key = f"orchestrator:session:{session_id}"
        try:
            await redis_client.hset(key, mapping={"data": json.dumps(data)})
            await redis_client.expire(key, 60 * 60)
        except Exception:
            MemoryStore._fallback[key] = json.dumps(data)

    @staticmethod
    async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
        key = f"orchestrator:session:{session_id}"
        try:
            v = await redis_client.hget(key, "data")
            if v:
                return json.loads(v)
        except Exception:
            v = MemoryStore._fallback.get(key)
            if v:
                return json.loads(v)
        return None

    @staticmethod
    def audit(action: str, details: Dict[str, Any]):
        db = SessionLocal()
        try:
            log = AuditLog(
                action=action,
                resource_type="orchestrator",
                resource_id=details.get("session_id"),
                details=details
            )
            db.add(log)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
