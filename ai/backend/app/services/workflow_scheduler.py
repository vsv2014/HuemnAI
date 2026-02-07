import logging
import time
from threading import Thread
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from app.db.session import SessionLocal
from app.db.models.scheduled_task import ScheduledTask, TaskStatus
from app.services.event_bus import publish, CHANNEL_CRM

logger = logging.getLogger(__name__)

def _is_due(now: datetime, task: ScheduledTask) -> bool:
    if task.status not in [TaskStatus.PENDING, TaskStatus.FAILED]:
        return False
    if task.scheduled_time and task.scheduled_time <= now:
        return True
    rec = task.recurrence or ""
    if rec.startswith("rate(") and rec.endswith(")"):
        # Example: rate(5 minutes) or rate(1 hours)
        inner = rec[5:-1].strip()
        parts = inner.split()
        if len(parts) == 2:
            try:
                value = int(parts[0])
            except ValueError:
                value = 0
            unit = parts[1].lower()
            last = task.executed_at or task.created_at
            if not last:
                return True
            delta = timedelta(minutes=value) if "min" in unit else timedelta(hours=value)
            return now - last >= delta
    if rec.startswith("at "):
        # Example: at 02:00 (daily)
        hm = rec[3:].strip()
        try:
            h, m = map(int, hm.split(":"))
            target = now.replace(hour=h, minute=m, second=0, microsecond=0)
            window = timedelta(minutes=1)
            if abs((now - target).total_seconds()) <= window.total_seconds():
                if not task.executed_at or (now.date() != task.executed_at.date()):
                    return True
        except Exception:
            return False
    return False

def _execute_task(task: ScheduledTask) -> Optional[Dict[str, Any]]:
    payload = task.payload or {}
    event = {
        "event": "workflow_triggered",
        "task_id": task.id,
        "task_type": task.task_type,
        "name": task.name,
        "payload": payload,
        "timestamp": datetime.utcnow().isoformat()
    }
    try:
        # For now publish to CRM channel; can be extended to specific channels
        # and call agent executor by task_type
        # This makes triggers visible to connected clients and workers
        import asyncio
        asyncio.run(publish(CHANNEL_CRM, event))
        return {"published": True}
    except Exception as e:
        logger.error(f"Failed executing task {task.id}: {e}")
        return {"published": False, "error": str(e)}

def start_workflow_scheduler():
    def loop():
        logger.info("Workflow scheduler started")
        while True:
            try:
                db = SessionLocal()
                now = datetime.utcnow()
                tasks = db.query(ScheduledTask).filter(ScheduledTask.is_active == True if hasattr(ScheduledTask, "is_active") else True).all()
                for t in tasks:
                    try:
                        if _is_due(now, t):
                            t.status = TaskStatus.PROCESSING
                            db.commit()
                            result = _execute_task(t)
                            t.status = TaskStatus.COMPLETED if (result and result.get("published")) else TaskStatus.FAILED
                            t.executed_at = now
                            db.commit()
                    except Exception as e:
                        logger.error(f"Task loop error for {t.id}: {e}")
                db.close()
            except Exception as e:
                logger.error(f"Scheduler loop error: {e}")
            time.sleep(60)
    Thread(target=loop, daemon=True).start()
