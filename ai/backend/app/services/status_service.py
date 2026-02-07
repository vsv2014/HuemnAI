import time
from datetime import datetime
from threading import Thread
from typing import List, Dict, Any, Optional
from app.db.session import SessionLocal
from app.db.models.ticket import Ticket
from app.db.models.user import User
from app.db.models.status_history import StatusHistory
from app.db.models.subscription import UserToolSubscription, UserToolSession
from app.db.session import SessionLocal as _SessionLocal
import logging

logger = logging.getLogger(__name__)

# Enhanced status tracking with activity monitoring
USER_STATUS: Dict[str, Dict[str, Any]] = {}

# Valid status types
VALID_STATUSES = ["online", "offline", "busy", "away", "lunch", "break", "meeting", "training", "leaves"]

def update_status(user_id: str, status: str, is_auto_update: bool = False):
    """Update user status and record activity. Persists to database for work time tracking."""
    # Validate status
    if status not in VALID_STATUSES:
        logger.warning(f"Invalid status '{status}' for user {user_id}. Using 'offline'.")
        status = "offline"
    
    current_time = time.time()
    current_datetime = datetime.utcnow()
    
    if user_id not in USER_STATUS:
        USER_STATUS[user_id] = {
            "status": status,
            "last_seen": current_time,
            "last_activity": current_time,
            "activity_count": 0,
            "status_history": [],
            "status_start_time": current_time  # Track when current status started
        }
    else:
        old_status = USER_STATUS[user_id].get("status")
        status_start_time = USER_STATUS[user_id].get("status_start_time", current_time)
        
        # Calculate duration in previous status
        duration_seconds = current_time - status_start_time if old_status else None
        
        USER_STATUS[user_id]["status"] = status
        USER_STATUS[user_id]["last_seen"] = current_time
        USER_STATUS[user_id]["last_activity"] = current_time
        USER_STATUS[user_id]["status_start_time"] = current_time  # Reset start time for new status
        
        # Track status changes and persist to database
        if old_status != status:
            # Add to in-memory history
            USER_STATUS[user_id]["status_history"].append({
                "status": status,
                "timestamp": current_time
            })
            # Keep only last 10 status changes in memory
            if len(USER_STATUS[user_id]["status_history"]) > 10:
                USER_STATUS[user_id]["status_history"] = USER_STATUS[user_id]["status_history"][-10:]
            
            # Persist to database for work time tracking
            db = SessionLocal()
            try:
                status_record = StatusHistory(
                    user_id=user_id,
                    status=status,
                    previous_status=old_status,
                    timestamp=current_datetime,
                    duration_seconds=duration_seconds,
                    is_auto_update="true" if is_auto_update else "false",
                    activity_count=USER_STATUS[user_id].get("activity_count", 0)
                )
                db.add(status_record)
                db.commit()
                logger.debug(f"Status change recorded: {user_id} from {old_status} to {status}")
            except Exception as e:
                logger.error(f"Failed to save status history: {e}")
                db.rollback()
            finally:
                db.close()

def record_activity(user_id: str):
    """Record user activity (mouse movement, keyboard input, etc.)"""
    current_time = time.time()
    if user_id not in USER_STATUS:
        USER_STATUS[user_id] = {
            "status": "online",
            "last_seen": current_time,
            "last_activity": current_time,
            "activity_count": 0,
            "status_history": []
        }
    
    USER_STATUS[user_id]["last_activity"] = current_time
    USER_STATUS[user_id]["last_seen"] = current_time
    USER_STATUS[user_id]["activity_count"] = USER_STATUS[user_id].get("activity_count", 0) + 1
    
    # Auto-update status based on activity
    # If user was away/busy but now active, set to online (unless explicitly set to busy)
    current_status = USER_STATUS[user_id].get("status", "offline")
    if current_status == "away":
        # If user becomes active after being away, set to online
        USER_STATUS[user_id]["status"] = "online"

def get_agent_status(user_id: str) -> Optional[Dict[str, Any]]:
    """Get detailed status for an agent"""
    if user_id not in USER_STATUS:
        return None
    
    data = USER_STATUS[user_id].copy()
    current_time = time.time()
    
    # Calculate time since last activity
    time_since_activity = current_time - data.get("last_activity", 0)
    time_since_seen = current_time - data.get("last_seen", 0)
    
    # Auto-update status based on inactivity
    current_status = data.get("status", "offline")
    
    # If no activity for 5 minutes, mark as away (unless already offline)
    if time_since_activity > 300 and current_status == "online":
        data["status"] = "away"
        USER_STATUS[user_id]["status"] = "away"
    
    # If no activity for 15 minutes, mark as offline
    if time_since_activity > 900:
        data["status"] = "offline"
        USER_STATUS[user_id]["status"] = "offline"
    
    data["time_since_activity"] = time_since_activity
    data["time_since_seen"] = time_since_seen
    data["is_active"] = time_since_activity < 60  # Active if activity in last minute
    
    return data

def start_status_watcher():
    """Start background thread to monitor user status and auto-update based on activity"""
    def watcher():
        while True:
            try:
                current_time = time.time()
                for user_id, data in list(USER_STATUS.items()):
                    last_activity = data.get("last_activity", 0)
                    time_since_activity = current_time - last_activity
                    current_status = data.get("status", "offline")
                    
                    # Auto-update status based on inactivity
                    if time_since_activity > 900:  # 15 minutes
                        if current_status != "offline":
                            update_status(user_id, "offline", is_auto_update=True)
                            logger.debug(f"Auto-set {user_id} to offline (inactive for {time_since_activity:.0f}s)")
                    elif time_since_activity > 300:  # 5 minutes
                        if current_status == "online":
                            update_status(user_id, "away", is_auto_update=True)
                            logger.debug(f"Auto-set {user_id} to away (inactive for {time_since_activity:.0f}s)")
                
                time.sleep(30)  # Check every 30 seconds
            except Exception as e:
                logger.error(f"Error in status watcher: {e}", exc_info=True)
                time.sleep(60)  # Wait longer on error

    Thread(target=watcher, daemon=True).start()
    logger.info("Status watcher started")

def get_available_agents() -> List[Dict[str, Any]]:
    """
    Returns list of agent dicts for agents with status 'online' or 'busy'.
    Each dict contains: id, status, last_seen, last_activity, open_ticket_count, email, skills, max_ticket_load
    """
    db = SessionLocal()
    try:
        agents: List[Dict[str, Any]] = []
        for user_id, data in USER_STATUS.items():
            status = data.get("status", "offline")
            # Include online and busy agents (busy can still take urgent tickets)
            if status not in ["online", "busy"]:
                continue

            # Count open tickets assigned to this user_id
            count = db.query(Ticket).filter(
                Ticket.assigned_to == user_id, 
                Ticket.status == 'open'
            ).count()

            # Try to look up user by numeric id or email
            user = None
            try:
                user = db.query(User).filter(User.id == int(user_id)).first()
            except (ValueError, TypeError):
                user = db.query(User).filter(User.email == user_id).first()

            # Get user skills and max load from database
            skills = []
            max_load = 10
            if user:
                if hasattr(user, 'skills') and user.skills:
                    skills = user.skills if isinstance(user.skills, list) else []
                if hasattr(user, 'max_ticket_load') and user.max_ticket_load:
                    max_load = user.max_ticket_load

            agents.append({
                "id": user_id,
                "status": status,
                "last_seen": data.get("last_seen", 0),
                "last_activity": data.get("last_activity", 0),
                "open_ticket_count": count,
                "email": user.email if user else None,
                "name": getattr(user, 'name', None) if user else None,
                "skills": skills,
                "max_ticket_load": max_load,
                "department": getattr(user, 'department', None) if user else None,
                "is_active": data.get("last_activity", 0) > (time.time() - 60),  # Active in last minute
            })

        # Prefer agents with low load and high activity
        agents.sort(key=lambda a: (
            a.get("open_ticket_count", 0),  # Lower load first
            -a.get("last_activity", 0)  # More recent activity first
        ))
        return agents
    finally:
        db.close()

def start_token_consumer(interval_seconds: int = 300):
    def _run():
        while True:
            try:
                db = _SessionLocal()
                now = time.time()
                sessions = db.query(UserToolSession).filter(UserToolSession.is_active == True).all()
                logger.info(f"Token consumer scanning {len(sessions)} sessions")
                for s in sessions:
                    if not s.last_activity_at:
                        continue
                    last_act = s.last_activity_at.timestamp()
                    if now - last_act > 15 * 60:
                        continue
                    last_cons = s.last_consumption_at.timestamp() if s.last_consumption_at else 0
                    if now - last_cons < interval_seconds:
                        logger.info(f"Skip session {s.id} tool={s.tool_name}: last_cons too recent")
                        continue
                    sub = None
                    if s.tool_subscription_id:
                        sub = db.query(UserToolSubscription).filter(UserToolSubscription.id == s.tool_subscription_id).first()
                    if not sub and s.user_id and s.tool_name:
                        sub = db.query(UserToolSubscription).filter(UserToolSubscription.user_id == s.user_id, UserToolSubscription.tool_name == s.tool_name).first()
                    if not sub:
                        continue
                    if sub.tokens_remaining is None:
                        sub.tokens_remaining = 50000
                        sub.tokens_total = 50000
                    if sub.tokens_remaining <= 0:
                        continue
                    sub.tokens_remaining -= 1
                    sub.tokens_used = (sub.tokens_used or 0) + 1
                    s.tokens_consumed = (s.tokens_consumed or 0) + 1
                    s.last_consumption_at = datetime.utcnow()
                    db.commit()
                    logger.debug(f"Consumed 1 token for user_id={s.user_id} tool={s.tool_name}; remaining={sub.tokens_remaining}")
                db.close()
            except Exception as e:
                logger.error(f"Token consumer error: {e}", exc_info=True)
            time.sleep(60)
    Thread(target=_run, daemon=True).start()
    logger.info("Token consumer started")

def get_all_agents_status() -> Dict[str, Dict[str, Any]]:
    """Get status for all agents"""
    result = {}
    for user_id in USER_STATUS.keys():
        result[user_id] = get_agent_status(user_id)
    return result
