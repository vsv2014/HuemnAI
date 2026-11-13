import logging
import time
import asyncio
from threading import Thread
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from app.db.session import SessionLocal
from app.db.models.scheduled_task import ScheduledTask, TaskStatus
from app.services.event_bus import publish, CHANNEL_CRM
from app.orchestrator.executor.executor import StepExecutor
from app.orchestrator.memory.store import MemoryStore
from app.services.socket_manager import manager
from app.core.celery_app import orchestrator_daily_run

logger = logging.getLogger(__name__)

def _utc_naive(value: datetime) -> datetime:
    """Normalize SQL timezone-aware timestamps for consistent UTC comparisons."""
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _next_recurrence(task: ScheduledTask, now: datetime) -> Optional[datetime]:
    """Return next UTC run or None for a one-shot/invalid schedule."""
    spec = (task.recurrence or "").strip().lower()
    if spec.startswith("rate(") and spec.endswith(")"):
        tokens = spec[5:-1].split()
        if len(tokens) != 2 or not tokens[0].isdigit() or int(tokens[0]) <= 0:
            return None
        value = int(tokens[0])
        if tokens[1].startswith("min"):
            return now + timedelta(minutes=value)
        if tokens[1].startswith("hour"):
            return now + timedelta(hours=value)
    if spec.startswith("at "):
        try:
            hours, minutes = map(int, spec[3:].split(":"))
            if not (0 <= hours <= 23 and 0 <= minutes <= 59):
                return None
            candidate = now.replace(hour=hours, minute=minutes, second=0, microsecond=0)
            return candidate if candidate > now else candidate + timedelta(days=1)
        except ValueError:
            return None
    return None


def _is_due(now: datetime, task: ScheduledTask) -> bool:
    if task.status not in (TaskStatus.PENDING, TaskStatus.FAILED):
        return False
    return not task.scheduled_time or _utc_naive(task.scheduled_time) <= _utc_naive(now)


def _execute_task(task: ScheduledTask) -> Optional[Dict[str, Any]]:
    payload = task.payload or {}
    # Orchestrator daily run
    if (task.task_type or "").lower() == "orchestrator_run":
        try:
            session_id = payload.get("session_id")
            if not session_id:
                raise ValueError("Missing session_id in payload")
            try:
                job = orchestrator_daily_run.delay(session_id)
                return {"published": True, "queued": True, "job_id": job.id}
            except Exception:
                pass
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            async def _run():
                try:
                    session = await MemoryStore.get_session(session_id)
                    if not session or "plan" not in session:
                        await manager.send_json({"event": "console", "data": {"line": f"Daily run skipped: plan not found (session {session_id})"}}, client_id=session_id)
                        return {"skipped": True}
                    exe = StepExecutor(session_id)
                    await manager.send_json({"event": "console", "data": {"line": "Daily automation run started"}}, client_id=session_id)
                    result = await exe.run(session["plan"])
                    await manager.send_json({"event": "console", "data": {"line": "Daily automation run completed"}}, client_id=session_id)
                    return {"published": True, "result": result}
                except Exception as e:
                    try:
                        await manager.send_json({"event": "console", "data": {"line": f"Daily run failed: {e}"}}, client_id=session_id)
                    except Exception:
                        pass
                    return {"published": False, "error": str(e)}
            out = loop.run_until_complete(_run())
            loop.close()
            return out
        except Exception as e:
            logger.error(f"Failed orchestrator_run for task {task.id}: {e}")
            return {"published": False, "error": str(e)}
    # Default: publish event for general workflows
    event = {
        "event": "workflow_triggered",
        "task_id": task.id,
        "task_type": task.task_type,
        "name": task.name,
        "payload": payload,
        "timestamp": datetime.utcnow().isoformat()
    }
    try:
        import asyncio
        asyncio.run(publish(CHANNEL_CRM, event))
        return {"published": True}
    except Exception as e:
        logger.error(f"Failed executing task {task.id}: {e}")
        return {"published": False, "error": str(e)}

def start_workflow_scheduler():
    """Run one scheduler replica. Dispatch is at-least-once, not exactly-once.

    Atomic status claims prevent concurrent schedulers claiming the same row.
    Stale PROCESSING rows can be recovered after a crash, but downstream tools
    must deduplicate side effects using task_id and business action identity.
    """
    def loop():
        logger.info("Dedicated workflow scheduler started")
        while True:
            db = SessionLocal()
            try:
                now = datetime.utcnow()
                candidates = db.query(ScheduledTask).filter(
                    ScheduledTask.status.in_((
                        TaskStatus.PENDING, TaskStatus.FAILED, TaskStatus.PROCESSING,
                    ))
                ).order_by(ScheduledTask.scheduled_time.asc()).limit(200).all()

                for task in candidates:
                    try:
                        last_update = _utc_naive(task.updated_at or task.created_at or now)
                        prior = task.result if isinstance(task.result, dict) else {}
                        attempts = int(prior.get("attempts", 0))
                        if task.status == TaskStatus.PROCESSING:
                            if now - last_update < timedelta(minutes=30):
                                continue
                            # No worker heartbeat available: mark stale claim failed
                            # and let the next sweep retry after backoff.
                            recovered = db.query(ScheduledTask).filter(
                                ScheduledTask.id == task.id,
                                ScheduledTask.status == TaskStatus.PROCESSING,
                            ).update({
                                ScheduledTask.status: TaskStatus.FAILED,
                                ScheduledTask.error: "stale processing lease recovered",
                            }, synchronize_session=False)
                            db.commit()
                            if recovered:
                                logger.warning("Recovered stale workflow task %s", task.id)
                            continue

                        if task.status == TaskStatus.FAILED:
                            if attempts >= 3:
                                continue
                            retry_delay = min(3600, 60 * (2 ** max(0, attempts - 1)))
                            if now - last_update < timedelta(seconds=retry_delay):
                                continue

                        if not _is_due(now, task):
                            continue

                        original_status = task.status
                        claimed = db.query(ScheduledTask).filter(
                            ScheduledTask.id == task.id,
                            ScheduledTask.status == original_status,
                        ).update({ScheduledTask.status: TaskStatus.PROCESSING}, synchronize_session=False)
                        db.commit()
                        if claimed != 1:
                            continue
                        db.refresh(task)

                        try:
                            result = _execute_task(task) or {"published": False, "error": "empty result"}
                        except Exception as exc:
                            logger.exception("Workflow task %s failed during dispatch", task.id)
                            result = {"published": False, "error": type(exc).__name__}

                        success = bool(result.get("published"))
                        attempts += 1
                        task.executed_at = datetime.utcnow()
                        task.error = None if success else str(result.get("error", "Task dispatch failed"))[:2000]
                        task.result = {**result, "attempts": 0 if success else attempts}
                        next_time = _next_recurrence(task, now) if success else None
                        task.status = TaskStatus.PENDING if next_time else (
                            TaskStatus.COMPLETED if success else TaskStatus.FAILED
                        )
                        if next_time:
                            task.scheduled_time = next_time.replace(tzinfo=timezone.utc)
                        db.commit()
                    except Exception:
                        db.rollback()
                        logger.exception("Unable to process scheduled task %s", task.id)
            except Exception:
                db.rollback()
                logger.exception("Workflow scheduler sweep failed")
            finally:
                db.close()
            time.sleep(60)

    Thread(target=loop, daemon=True).start()
