from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
from app.db.session import get_db
from app.api.auth import get_current_user
from app.db.models.scheduled_task import ScheduledTask, TaskStatus

router = APIRouter()

class CreateTask(BaseModel):
    agent_id: int
    task_type: str
    name: Optional[str] = None
    description: Optional[str] = None
    scheduled_time: Optional[str] = None  # ISO string
    recurrence: Optional[str] = None      # rate(5 minutes) or at HH:MM
    payload: Optional[Dict[str, Any]] = None

@router.post("/tasks")
async def create_task(
    req: CreateTask,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    st = ScheduledTask(
        agent_id=req.agent_id,
        task_type=req.task_type,
        name=req.name,
        description=req.description,
        scheduled_time=datetime.fromisoformat(req.scheduled_time) if req.scheduled_time else datetime.utcnow(),
        recurrence=req.recurrence,
        status=TaskStatus.PENDING,
        payload=req.payload or {},
        created_by=user.id
    )
    db.add(st)
    db.commit()
    db.refresh(st)
    return {"success": True, "id": st.id}

@router.get("/tasks")
async def list_tasks(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    rows = db.query(ScheduledTask).order_by(ScheduledTask.id.desc()).all()
    tasks = []
    for r in rows:
        tasks.append({
            "id": r.id,
            "agent_id": r.agent_id,
            "task_type": r.task_type,
            "name": r.name,
            "scheduled_time": r.scheduled_time.isoformat() if r.scheduled_time else None,
            "recurrence": r.recurrence,
            "status": r.status.value if r.status else None,
            "executed_at": r.executed_at.isoformat() if r.executed_at else None
        })
    return {"success": True, "tasks": tasks}

@router.post("/tasks/{task_id}/cancel")
async def cancel_task(
    task_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    r = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Task not found")
    r.status = TaskStatus.CANCELLED
    db.commit()
    return {"success": True}
