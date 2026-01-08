from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, case
from datetime import datetime, timedelta
from typing import Dict, List
from app.db.session import SessionLocal
from app.db.models.ticket import Ticket
from app.db.models.status_history import StatusHistory
from app.db.models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# SLA thresholds (in hours)
SLA_HIGH_PRIORITY = 4  # 4 hours for high priority
SLA_MEDIUM_PRIORITY = 24  # 24 hours for medium priority
SLA_LOW_PRIORITY = 72  # 72 hours for low priority


def calculate_sla_status(ticket: Ticket) -> str:
    """Calculate if ticket SLA is breached or satisfied"""
    if ticket.status == "resolved" and ticket.resolved_at and ticket.created_at:
        time_taken = (ticket.resolved_at - ticket.created_at).total_seconds() / 3600
        
        sla_threshold = {
            "high": SLA_HIGH_PRIORITY,
            "urgent": SLA_HIGH_PRIORITY,
            "medium": SLA_MEDIUM_PRIORITY,
            "low": SLA_LOW_PRIORITY,
        }.get(ticket.priority.lower(), SLA_MEDIUM_PRIORITY)
        
        return "satisfied" if time_taken <= sla_threshold else "breached"
    elif ticket.status != "resolved":
        # For open tickets, check if current time exceeds SLA
        if ticket.created_at:
            time_elapsed = (datetime.utcnow() - ticket.created_at).total_seconds() / 3600
            sla_threshold = {
                "high": SLA_HIGH_PRIORITY,
                "urgent": SLA_HIGH_PRIORITY,
                "medium": SLA_MEDIUM_PRIORITY,
                "low": SLA_LOW_PRIORITY,
            }.get(ticket.priority.lower(), SLA_MEDIUM_PRIORITY)
            return "breached" if time_elapsed > sla_threshold else "pending"
    return "pending"


def get_team_level(assigned_to: str) -> str:
    """Determine team level based on assigned agent"""
    if not assigned_to:
        return "unassigned"
    # Simple logic - can be enhanced with actual team data
    if assigned_to.startswith("l1") or assigned_to.startswith("L1"):
        return "L1"
    elif assigned_to.startswith("l2") or assigned_to.startswith("L2"):
        return "L2"
    else:
        return "L1"  # Default to L1


@router.get("/analytics/overview")
async def get_analytics_overview():
    """
    Get comprehensive analytics overview with all metrics
    """
    db: Session = SessionLocal()
    try:
        # Date ranges
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        
        # Get all tickets
        all_tickets = db.query(Ticket).all()
        total_tickets = len(all_tickets)
        
        # Status breakdown
        status_counts = db.query(
            Ticket.status,
            func.count(Ticket.id).label('count')
        ).group_by(Ticket.status).all()
        
        status_dict = {status: count for status, count in status_counts}
        open_tickets = status_dict.get("open", 0)
        in_progress = status_dict.get("in_progress", 0)
        resolved_tickets = status_dict.get("resolved", 0)
        closed_tickets = status_dict.get("closed", 0)
        
        # Priority breakdown
        priority_counts = db.query(
            Ticket.priority,
            func.count(Ticket.id).label('count')
        ).group_by(Ticket.priority).all()
        
        priority_dict = {priority: count for priority, count in priority_counts}
        critical_tickets = priority_dict.get("urgent", 0) + priority_dict.get("high", 0)
        
        # Calculate solving rate
        resolved_count = resolved_tickets + closed_tickets
        solving_rate = (resolved_count / total_tickets * 100) if total_tickets > 0 else 0
        
        # Pending rate
        pending_count = open_tickets + in_progress
        pending_rate = (pending_count / total_tickets * 100) if total_tickets > 0 else 0
        
        # Backlog (tickets older than 7 days)
        backlog = db.query(Ticket).filter(
            and_(
                Ticket.status.in_(["open", "in_progress"]),
                Ticket.created_at < week_ago
            )
        ).count()
        
        # Inflow (tickets created today)
        inflow_today = db.query(Ticket).filter(
            Ticket.created_at >= today_start
        ).count()
        
        # Inflow this week
        inflow_week = db.query(Ticket).filter(
            Ticket.created_at >= week_ago
        ).count()
        
        # Inflow this month
        inflow_month = db.query(Ticket).filter(
            Ticket.created_at >= month_ago
        ).count()
        
        # Team level breakdown
        l1_pending = 0
        l2_pending = 0
        escalated_count = 0
        
        for ticket in all_tickets:
            if ticket.status in ["open", "in_progress"]:
                team_level = get_team_level(ticket.assigned_to or "")
                if team_level == "L1":
                    l1_pending += 1
                elif team_level == "L2":
                    l2_pending += 1
                # Check if escalated (moved from L1 to L2)
                if ticket.assigned_to and "escalated" in ticket.assigned_to.lower():
                    escalated_count += 1
        
        # SLA analysis
        sla_breached = 0
        sla_satisfied = 0
        sla_pending = 0
        
        for ticket in all_tickets:
            sla_status = calculate_sla_status(ticket)
            if sla_status == "breached":
                sla_breached += 1
            elif sla_status == "satisfied":
                sla_satisfied += 1
            else:
                sla_pending += 1
        
        # Time series data (last 7 days)
        time_series_data = []
        for i in range(7):
            date = (now - timedelta(days=6-i)).replace(hour=0, minute=0, second=0, microsecond=0)
            date_end = date + timedelta(days=1)
            
            created = db.query(Ticket).filter(
                and_(
                    Ticket.created_at >= date,
                    Ticket.created_at < date_end
                )
            ).count()
            
            resolved = db.query(Ticket).filter(
                and_(
                    Ticket.resolved_at >= date,
                    Ticket.resolved_at < date_end
                )
            ).count()
            
            time_series_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "created": created,
                "resolved": resolved,
                "pending": created - resolved
            })
        
        # Performance metrics
        avg_resolution_time = 0
        if resolved_count > 0:
            resolved_tickets_with_time = db.query(Ticket).filter(
                and_(
                    Ticket.status.in_(["resolved", "closed"]),
                    Ticket.resolved_at.isnot(None),
                    Ticket.created_at.isnot(None)
                )
            ).all()
            
            if resolved_tickets_with_time:
                total_time = sum(
                    (t.resolved_at - t.created_at).total_seconds() / 3600
                    for t in resolved_tickets_with_time
                    if t.resolved_at and t.created_at
                )
                avg_resolution_time = total_time / len(resolved_tickets_with_time)
        
        # Priority distribution
        priority_distribution = {
            "low": priority_dict.get("low", 0),
            "medium": priority_dict.get("medium", 0),
            "high": priority_dict.get("high", 0),
            "urgent": priority_dict.get("urgent", 0),
        }
        
        # Status distribution
        status_distribution = {
            "open": open_tickets,
            "in_progress": in_progress,
            "resolved": resolved_tickets,
            "closed": closed_tickets,
        }
        
        return {
            "overview": {
                "total_tickets": total_tickets,
                "solving_rate": round(solving_rate, 2),
                "pending_rate": round(pending_rate, 2),
                "backlog": backlog,
                "inflow_today": inflow_today,
                "inflow_week": inflow_week,
                "inflow_month": inflow_month,
                "critical_tickets": critical_tickets,
                "l1_pending": l1_pending,
                "l2_pending": l2_pending,
                "escalated": escalated_count,
                "sla_breached": sla_breached,
                "sla_satisfied": sla_satisfied,
                "sla_pending": sla_pending,
                "avg_resolution_time_hours": round(avg_resolution_time, 2),
            },
            "time_series": time_series_data,
            "priority_distribution": priority_distribution,
            "status_distribution": status_distribution,
            "sla_metrics": {
                "breached": sla_breached,
                "satisfied": sla_satisfied,
                "pending": sla_pending,
                "breach_rate": round((sla_breached / total_tickets * 100) if total_tickets > 0 else 0, 2),
                "satisfaction_rate": round((sla_satisfied / resolved_count * 100) if resolved_count > 0 else 0, 2),
            },
            "performance": {
                "tickets_per_day": round(inflow_week / 7, 2) if inflow_week > 0 else 0,
                "resolution_rate": round(solving_rate, 2),
                "escalation_rate": round((escalated_count / total_tickets * 100) if total_tickets > 0 else 0, 2),
            }
        }
        
        # Add work time tracking data
        work_time_data = calculate_work_time_metrics(db, today_start, week_ago, month_ago)
        result["work_time"] = work_time_data
        
        return result
    except Exception as e:
        logger.error(f"Error fetching analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch analytics: {str(e)}")
    finally:
        db.close()


def calculate_work_time_metrics(db: Session, today_start: datetime, week_ago: datetime, month_ago: datetime) -> Dict:
    """
    Calculate work time metrics from status history.
    Tracks how much time employees spent in each status (online, busy, away, offline).
    """
    try:
        # Get all unique users
        all_users = db.query(StatusHistory.user_id).distinct().all()
        user_ids = [u[0] for u in all_users]
        
        # Calculate work time for each user
        employee_work_time = []
        total_online_time = 0
        total_busy_time = 0
        total_away_time = 0
        total_offline_time = 0
        
        for user_id in user_ids:
            # Get all status changes for this user
            status_changes = db.query(StatusHistory).filter(
                StatusHistory.user_id == user_id
            ).order_by(StatusHistory.timestamp).all()
            
            if not status_changes:
                continue
            
            # Calculate time spent in each status
            online_time = 0
            busy_time = 0
            away_time = 0
            offline_time = 0
            
            # Get current status from USER_STATUS if available
            from app.services.status_service import USER_STATUS
            current_status = USER_STATUS.get(user_id, {}).get("status", "offline")
            current_time = datetime.utcnow()
            
            # Calculate time from status history
            for i, change in enumerate(status_changes):
                if change.duration_seconds:
                    duration_hours = change.duration_seconds / 3600
                    if change.previous_status == "online":
                        online_time += duration_hours
                    elif change.previous_status == "busy":
                        busy_time += duration_hours
                    elif change.previous_status == "away":
                        away_time += duration_hours
                    elif change.previous_status == "offline":
                        offline_time += duration_hours
            
            # Calculate time in current status
            if status_changes:
                last_change = status_changes[-1]
                time_in_current_status = (current_time - last_change.timestamp).total_seconds() / 3600
                if current_status == "online":
                    online_time += time_in_current_status
                elif current_status == "busy":
                    busy_time += time_in_current_status
                elif current_status == "away":
                    away_time += time_in_current_status
                elif current_status == "offline":
                    offline_time += time_in_current_status
            
            total_work_time = online_time + busy_time + away_time
            active_work_time = online_time + busy_time  # Active = online + busy
            
            # Get user info if available
            user = None
            try:
                user = db.query(User).filter(User.id == int(user_id)).first()
            except (ValueError, TypeError):
                try:
                    user = db.query(User).filter(User.email == user_id).first()
                except:
                    pass
            
            employee_work_time.append({
                "user_id": user_id,
                "name": getattr(user, "name", None) if user else user_id,
                "email": getattr(user, "email", None) if user else None,
                "online_hours": round(online_time, 2),
                "busy_hours": round(busy_time, 2),
                "away_hours": round(away_time, 2),
                "offline_hours": round(offline_time, 2),
                "total_work_hours": round(total_work_time, 2),
                "active_work_hours": round(active_work_time, 2),
                "current_status": current_status,
            })
            
            total_online_time += online_time
            total_busy_time += busy_time
            total_away_time += away_time
            total_offline_time += offline_time
        
        # Calculate today's work time
        today_status_changes = db.query(StatusHistory).filter(
            StatusHistory.timestamp >= today_start
        ).all()
        
        today_online = sum(s.duration_seconds or 0 for s in today_status_changes if s.previous_status == "online") / 3600
        today_busy = sum(s.duration_seconds or 0 for s in today_status_changes if s.previous_status == "busy") / 3600
        
        # Calculate this week's work time
        week_status_changes = db.query(StatusHistory).filter(
            StatusHistory.timestamp >= week_ago
        ).all()
        
        week_online = sum(s.duration_seconds or 0 for s in week_status_changes if s.previous_status == "online") / 3600
        week_busy = sum(s.duration_seconds or 0 for s in week_status_changes if s.previous_status == "busy") / 3600
        
        # Calculate this month's work time
        month_status_changes = db.query(StatusHistory).filter(
            StatusHistory.timestamp >= month_ago
        ).all()
        
        month_online = sum(s.duration_seconds or 0 for s in month_status_changes if s.previous_status == "online") / 3600
        month_busy = sum(s.duration_seconds or 0 for s in month_status_changes if s.previous_status == "busy") / 3600
        
        return {
            "employees": employee_work_time,
            "totals": {
                "total_online_hours": round(total_online_time, 2),
                "total_busy_hours": round(total_busy_time, 2),
                "total_away_hours": round(total_away_time, 2),
                "total_offline_hours": round(total_offline_time, 2),
                "total_active_hours": round(total_online_time + total_busy_time, 2),
            },
            "today": {
                "online_hours": round(today_online, 2),
                "busy_hours": round(today_busy, 2),
                "active_hours": round(today_online + today_busy, 2),
            },
            "this_week": {
                "online_hours": round(week_online, 2),
                "busy_hours": round(week_busy, 2),
                "active_hours": round(week_online + week_busy, 2),
            },
            "this_month": {
                "online_hours": round(month_online, 2),
                "busy_hours": round(month_busy, 2),
                "active_hours": round(month_online + month_busy, 2),
            },
            "employee_count": len(employee_work_time),
        }
    except Exception as e:
        logger.error(f"Error calculating work time metrics: {str(e)}")
        # Return empty but valid structure
        return {
            "employees": [],
            "totals": {
                "total_online_hours": 0,
                "total_busy_hours": 0,
                "total_away_hours": 0,
                "total_offline_hours": 0,
                "total_active_hours": 0,
            },
            "today": {
                "online_hours": 0,
                "busy_hours": 0,
                "active_hours": 0,
            },
            "this_week": {
                "online_hours": 0,
                "busy_hours": 0,
                "active_hours": 0,
            },
            "this_month": {
                "online_hours": 0,
                "busy_hours": 0,
                "active_hours": 0,
            },
            "employee_count": 0,
        }


@router.get("/analytics/trends")
async def get_analytics_trends(days: int = 30):
    """
    Get trend data for the last N days
    """
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        start_date = now - timedelta(days=days)
        
        trends = []
        for i in range(days):
            date = (start_date + timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            date_end = date + timedelta(days=1)
            
            created = db.query(Ticket).filter(
                and_(
                    Ticket.created_at >= date,
                    Ticket.created_at < date_end
                )
            ).count()
            
            resolved = db.query(Ticket).filter(
                and_(
                    Ticket.resolved_at >= date,
                    Ticket.resolved_at < date_end
                )
            ).count()
            
            open_at_start = db.query(Ticket).filter(
                and_(
                    Ticket.created_at < date,
                    or_(
                        Ticket.status.in_(["open", "in_progress"]),
                        and_(
                            Ticket.status.in_(["resolved", "closed"]),
                            Ticket.resolved_at >= date
                        )
                    )
                )
            ).count()
            
            trends.append({
                "date": date.strftime("%Y-%m-%d"),
                "created": created,
                "resolved": resolved,
                "open": open_at_start + created - resolved
            })
        
        return {"trends": trends}
    except Exception as e:
        logger.error(f"Error fetching trends: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch trends: {str(e)}")
    finally:
        db.close()

