from typing import Optional, List
import io
import csv
import json
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.session import get_db
from app.db.models.audit import AuditLog
from app.core.rbac import check_permission, Permission

router = APIRouter()

@router.get("/", dependencies=[Depends(check_permission(Permission.VIEW_AUDIT_LOGS))])
def read_audit_logs(
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    
    total = query.count()
    logs = query.order_by(desc(AuditLog.timestamp)).offset(skip).limit(limit).all()
    
    return {"total": total, "logs": logs}

@router.get("/export", dependencies=[Depends(check_permission(Permission.VIEW_AUDIT_LOGS))])
def export_audit_logs(
    format: str = "csv",
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Export audit logs to CSV or JSON.
    """
    query = db.query(AuditLog)
    
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
        
    logs = query.order_by(AuditLog.timestamp.desc()).limit(1000).all() # Limit export to 1000 for safety
    
    if format.lower() == "json":
        data = [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "details": log.details,
                "ip_address": log.ip_address,
                "timestamp": log.timestamp.isoformat()
            }
            for log in logs
        ]
        return StreamingResponse(
            io.BytesIO(json.dumps(data, indent=2).encode()),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=audit_logs.json"}
        )
        
    else: # CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "User ID", "Action", "Resource Type", "Resource ID", "IP Address", "Timestamp", "Details"])
        
        for log in logs:
            writer.writerow([
                log.id,
                log.user_id,
                log.action,
                log.resource_type,
                log.resource_id,
                log.ip_address,
                log.timestamp.isoformat(),
                json.dumps(log.details) if log.details else ""
            ])
            
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=audit_logs.csv"}
        )
