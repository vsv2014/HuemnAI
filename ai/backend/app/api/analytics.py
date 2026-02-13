from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, case
from datetime import datetime, timedelta
from typing import Dict, List
from app.db.session import SessionLocal, get_db
from app.db.models.ticket import Ticket
from app.db.models.status_history import StatusHistory
from app.db.models.user import User
from app.db.models.agent import Agent, AgentAnalyticsEvent, AgentConversation, AgentFlow
from app.api.auth import get_current_user
from app.db.models.subscription import UserAccount
from app.utils.subscription import consume_tool_tokens
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

def require_analytics_access(
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    consume_tool_tokens(db, user, "analytics_dashboard", 1)

router = APIRouter(dependencies=[Depends(require_analytics_access)])

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
    """Get high-level analytics overview for the dashboard"""
    db: Session = SessionLocal()
    try:
        # --- 1. Overview Stats ---
        total_tickets = db.query(Ticket).count()
        resolved_tickets = db.query(Ticket).filter(Ticket.status == "resolved").count()
        pending_tickets = db.query(Ticket).filter(Ticket.status.in_(["open", "in_progress"])).count()
        
        solving_rate = (resolved_tickets / total_tickets * 100) if total_tickets > 0 else 0
        pending_rate = (pending_tickets / total_tickets * 100) if total_tickets > 0 else 0
        
        yesterday = datetime.utcnow() - timedelta(days=1)
        backlog = db.query(Ticket).filter(Ticket.status == "open", Ticket.created_at < yesterday).count()
        
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        month_start = today_start - timedelta(days=30)
        
        inflow_today = db.query(Ticket).filter(Ticket.created_at >= today_start).count()
        inflow_week = db.query(Ticket).filter(Ticket.created_at >= week_start).count()
        inflow_month = db.query(Ticket).filter(Ticket.created_at >= month_start).count()
        
        critical_tickets = db.query(Ticket).filter(Ticket.priority.in_(["urgent", "high"]), Ticket.status != "resolved").count()
        l1_pending = db.query(Ticket).filter(Ticket.assigned_to.ilike("l1%"), Ticket.status != "resolved").count()
        l2_pending = db.query(Ticket).filter(Ticket.assigned_to.ilike("l2%"), Ticket.status != "resolved").count()
        escalated = db.query(Ticket).filter(Ticket.assigned_to.ilike("l2%"), Ticket.status != "resolved").count()

        # SLA Stats
        recent_tickets = db.query(Ticket).order_by(Ticket.created_at.desc()).limit(1000).all()
        sla_breached = 0
        sla_satisfied = 0
        sla_pending = 0
        total_resolution_time = 0
        resolution_count = 0
        
        for ticket in recent_tickets:
            sla_status = calculate_sla_status(ticket)
            if sla_status == "breached": sla_breached += 1
            elif sla_status == "satisfied": sla_satisfied += 1
            else: sla_pending += 1
                
            if ticket.status == "resolved" and ticket.resolved_at and ticket.created_at:
                duration = (ticket.resolved_at - ticket.created_at).total_seconds() / 3600
                total_resolution_time += duration
                resolution_count += 1
                
        avg_resolution_time = (total_resolution_time / resolution_count) if resolution_count > 0 else 0
        
        overview_data = {
            "total_tickets": total_tickets,
            "solving_rate": round(solving_rate, 1),
            "pending_rate": round(pending_rate, 1),
            "backlog": backlog,
            "inflow_today": inflow_today,
            "inflow_week": inflow_week,
            "inflow_month": inflow_month,
            "critical_tickets": critical_tickets,
            "l1_pending": l1_pending,
            "l2_pending": l2_pending,
            "escalated": escalated,
            "sla_breached": sla_breached,
            "sla_satisfied": sla_satisfied,
            "sla_pending": sla_pending,
            "avg_resolution_time_hours": round(avg_resolution_time, 1)
        }

        # --- 2. Time Series (Last 7 days) ---
        time_series = []
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=6) # 7 days total including today
        current_date = start_date
        while current_date <= end_date:
            day_start = current_date.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            created = db.query(Ticket).filter(Ticket.created_at >= day_start, Ticket.created_at < day_end).count()
            resolved = db.query(Ticket).filter(Ticket.resolved_at >= day_start, Ticket.resolved_at < day_end).count()
            pending = db.query(Ticket).filter(Ticket.created_at < day_end, or_(Ticket.resolved_at == None, Ticket.resolved_at >= day_end)).count()
            
            time_series.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "created": created,
                "resolved": resolved,
                "pending": pending
            })
            current_date += timedelta(days=1)

        # --- 3. Priority Distribution ---
        priorities = ["low", "medium", "high", "urgent"]
        priority_dist = {}
        for p in priorities:
            priority_dist[p] = db.query(Ticket).filter(Ticket.priority == p).count()

        # --- 4. Status Distribution ---
        statuses = ["open", "in_progress", "resolved", "closed"]
        status_dist = {}
        for s in statuses:
            status_dist[s] = db.query(Ticket).filter(Ticket.status == s).count()

        # --- 5. SLA Metrics ---
        total_sla = sla_breached + sla_satisfied + sla_pending
        sla_metrics_data = {
            "breached": sla_breached,
            "satisfied": sla_satisfied,
            "pending": sla_pending,
            "breach_rate": round((sla_breached / total_sla * 100) if total_sla > 0 else 0, 1),
            "satisfaction_rate": round((sla_satisfied / total_sla * 100) if total_sla > 0 else 0, 1)
        }

        # --- 6. Performance ---
        # Tickets per day (avg over last 7 days)
        total_week_tickets = sum(d['created'] for d in time_series)
        tickets_per_day = round(total_week_tickets / 7, 1)
        
        performance_data = {
            "tickets_per_day": tickets_per_day,
            "resolution_rate": round(solving_rate, 1),
            "escalation_rate": round((escalated / total_tickets * 100) if total_tickets > 0 else 0, 1)
        }

        return {
            "overview": overview_data,
            "time_series": time_series,
            "priority_distribution": priority_dist,
            "status_distribution": status_dist,
            "sla_metrics": sla_metrics_data,
            "performance": performance_data
        }
    finally:
        db.close()


@router.get("/analytics/trends")
async def get_analytics_trends(days: int = 7):
    """Get time-series trends for analytics"""
    db: Session = SessionLocal()
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        trends = []
        
        # Loop through each day
        current_date = start_date
        while current_date <= end_date:
            day_start = current_date.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            created_count = db.query(Ticket).filter(
                Ticket.created_at >= day_start,
                Ticket.created_at < day_end
            ).count()
            
            resolved_count = db.query(Ticket).filter(
                Ticket.resolved_at >= day_start,
                Ticket.resolved_at < day_end
            ).count()
            
            # Pending snapshot (approximation)
            pending_count = db.query(Ticket).filter(
                Ticket.created_at < day_end,
                or_(Ticket.resolved_at == None, Ticket.resolved_at >= day_end)
            ).count()
            
            trends.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "created": created_count,
                "resolved": resolved_count,
                "pending": pending_count
            })
            
            current_date += timedelta(days=1)
            
        return trends
    finally:
        db.close()


@router.get("/analytics/va/flows/{agent_id}")
async def get_flow_analytics(agent_id: int):
    """
    Get flow analytics for a specific agent (Flow execution paths, success rates, drop-offs)
    """
    db: Session = SessionLocal()
    try:
        # 1. Get defined flows
        flows = db.query(AgentFlow).filter(
            AgentFlow.agent_id == agent_id,
            AgentFlow.is_active == True
        ).all()
        
        flow_analytics = []
        
        # If we have defined flows, analyze them
        if flows:
            for flow in flows:
                # Mock analysis for defined flows for now
                # In real impl, we would query conversations that matched this flow's pattern
                flow_analytics.append({
                    "id": flow.id,
                    "name": flow.name,
                    "steps": [node.get("name", "Unknown") for node in flow.flow_definition.get("nodes", [])] if isinstance(flow.flow_definition, dict) else ["Start", "Process", "End"],
                    "usage": 120 + flow.id * 50,
                    "successRate": 85.0 + flow.id * 2,
                    "avgDuration": "2.5m",
                    "dropOffRates": [0, 5, 10, 2, 0] # % drop off at each step
                })
        
        # If no defined flows or to supplement, look at actual conversation paths
        # This is "Discovered Flows"
        if not flow_analytics:
            # Construct flows from analytics events (mocked logic for demo)
            # In production: Aggregate node_entry events sequence by conversation_id
            
            # Mock Real-looking Data
            flow_analytics = [
                {
                    "id": 1,
                    "name": "Flight Booking",
                    "type": "transactional",
                    "steps": [
                        {"name": "Start", "type": "start", "stats": {"entries": 1247, "exits": 1247, "avg_time": "0s"}},
                        {"name": "Intent: Book Flight", "type": "intent", "stats": {"entries": 1247, "exits": 1180, "avg_time": "1.2s"}},
                        {"name": "Collect Destination", "type": "entity", "stats": {"entries": 1180, "exits": 1100, "avg_time": "4.5s"}},
                        {"name": "Collect Date", "type": "entity", "stats": {"entries": 1100, "exits": 1050, "avg_time": "3.8s"}},
                        {"name": "Search Flights API", "type": "api", "stats": {"entries": 1050, "exits": 1020, "avg_time": "2.1s"}},
                        {"name": "Present Options", "type": "response", "stats": {"entries": 1020, "exits": 980, "avg_time": "15s"}},
                        {"name": "Select Flight", "type": "input", "stats": {"entries": 980, "exits": 950, "avg_time": "5.2s"}},
                        {"name": "Payment", "type": "payment", "stats": {"entries": 950, "exits": 900, "avg_time": "45s"}},
                        {"name": "Confirmation", "type": "end", "stats": {"entries": 900, "exits": 0, "avg_time": "0s"}}
                    ],
                    "usage": 1247,
                    "successRate": 72.2, # 900/1247
                    "avgDuration": "3m 12s",
                    "trend": "up"
                },
                {
                    "id": 2,
                    "name": "Check Flight Status",
                    "type": "informational",
                    "steps": [
                        {"name": "Start", "type": "start", "stats": {"entries": 892, "exits": 892, "avg_time": "0s"}},
                        {"name": "Intent: Check Status", "type": "intent", "stats": {"entries": 892, "exits": 880, "avg_time": "0.8s"}},
                        {"name": "Collect Flight #", "type": "entity", "stats": {"entries": 880, "exits": 850, "avg_time": "5.1s"}},
                        {"name": "Status API", "type": "api", "stats": {"entries": 850, "exits": 845, "avg_time": "1.5s"}},
                        {"name": "Show Status", "type": "response", "stats": {"entries": 845, "exits": 845, "avg_time": "0s"}},
                        {"name": "End", "type": "end", "stats": {"entries": 845, "exits": 0, "avg_time": "0s"}}
                    ],
                    "usage": 892,
                    "successRate": 94.7,
                    "avgDuration": "45s",
                    "trend": "stable"
                },
                {
                    "id": 3,
                    "name": "Baggage Inquiry (Handoff)",
                    "type": "support",
                    "steps": [
                        {"name": "Start", "type": "start", "stats": {"entries": 456, "exits": 456, "avg_time": "0s"}},
                        {"name": "Intent: Lost Baggage", "type": "intent", "stats": {"entries": 456, "exits": 450, "avg_time": "1.1s"}},
                        {"name": "KB Search", "type": "rag", "stats": {"entries": 450, "exits": 400, "avg_time": "2.5s"}},
                        {"name": "Provide Info", "type": "response", "stats": {"entries": 400, "exits": 250, "avg_time": "10s"}},
                        {"name": "Escalate Request", "type": "intent", "stats": {"entries": 250, "exits": 240, "avg_time": "3.2s"}},
                        {"name": "Agent Handoff", "type": "handoff", "stats": {"entries": 240, "exits": 240, "avg_time": "0s"}}
                    ],
                    "usage": 456,
                    "successRate": 52.6,
                    "avgDuration": "2m 10s",
                    "trend": "down"
                }
            ]
            
        return {
            "flows": flow_analytics,
            "total_executions": sum(f["usage"] for f in flow_analytics),
            "avg_success_rate": sum(f["successRate"] for f in flow_analytics) / len(flow_analytics) if flow_analytics else 0
        }
    finally:
        db.close()

@router.get("/analytics/va/logs/{agent_id}")
async def get_task_execution_logs(
    agent_id: int,
    status: str = "all",
    limit: int = 50,
    offset: int = 0
):
    """
    Get task execution logs (AgentAnalyticsEvents) for a specific agent
    """
    db: Session = SessionLocal()
    try:
        query = db.query(AgentAnalyticsEvent).filter(
            AgentAnalyticsEvent.agent_id == agent_id
        )
        
        if status != "all":
            if status == "error":
                query = query.filter(AgentAnalyticsEvent.event_type.in_(['error', 'exception']))
            elif status == "success":
                 query = query.filter(AgentAnalyticsEvent.event_type.notin_(['error', 'exception']))
        
        total_count = query.count()
        
        events = query.order_by(AgentAnalyticsEvent.created_at.desc())\
                      .offset(offset).limit(limit).all()
        
        logs = []
        for event in events:
            # Try to get user info if conversation_id exists
            user_id = "Unknown"
            if event.conversation_id:
                conv = db.query(AgentConversation).filter(AgentConversation.id == event.conversation_id).first()
                if conv and conv.user_id:
                    user_id = str(conv.user_id)
            
            # Determine status
            log_status = "success"
            if event.event_type in ['error', 'exception']:
                log_status = "error"
                
            # Determine duration (mock if not present)
            duration = "0.5s" # Default
            if event.properties:
                if 'duration_ms' in event.properties:
                    try:
                        duration = f"{float(event.properties['duration_ms'])/1000:.2f}s"
                    except:
                        pass
                elif 'duration' in event.properties:
                    duration = str(event.properties['duration'])
            
            logs.append({
                "id": event.id,
                "task": event.event_name,
                "type": event.event_type,
                "status": log_status,
                "timestamp": event.created_at.isoformat() if event.created_at else None,
                "duration": duration,
                "user": user_id,
                "details": str(event.properties),
                "full_properties": event.properties
            })
            
        # If no logs, return mock data for demo purposes
        if not logs and offset == 0:
             now = datetime.utcnow()
             logs = [
                {
                  "id": 1,
                  "task": "Intent Recognition",
                  "type": "intent",
                  "status": "success",
                  "timestamp": (now - timedelta(minutes=5)).isoformat(),
                  "duration": "0.8s",
                  "user": "user_123",
                  "details": "Recognized intent: 'book_flight' with 95% confidence",
                  "full_properties": {"confidence": 0.95, "intent": "book_flight", "input": "I want to book a flight"}
                },
                {
                  "id": 2,
                  "task": "Entity Extraction",
                  "type": "entity",
                  "status": "success",
                  "timestamp": (now - timedelta(minutes=12)).isoformat(),
                  "duration": "1.1s",
                  "user": "user_456",
                  "details": "Extracted entities: destination=Paris, date=2024-03-15",
                  "full_properties": {"entities": [{"name": "destination", "value": "Paris"}, {"name": "date", "value": "2024-03-15"}]}
                },
                {
                  "id": 3,
                  "task": "API Call",
                  "type": "api_call",
                  "status": "error",
                  "timestamp": (now - timedelta(minutes=25)).isoformat(),
                  "duration": "2.3s",
                  "user": "user_789",
                  "details": "API timeout after 2s - retrying...",
                  "full_properties": {"error": "TimeoutError", "url": "https://api.weather.com", "retries": 3}
                },
                {
                  "id": 4,
                  "task": "Database Query",
                  "type": "db_query",
                  "status": "success",
                  "timestamp": (now - timedelta(minutes=45)).isoformat(),
                  "duration": "1.5s",
                  "user": "user_321",
                  "details": "Retrieved 15 flight options",
                  "full_properties": {"query": "SELECT * FROM flights WHERE dest='Paris'", "rows": 15}
                },
                {
                  "id": 5,
                  "task": "Response Generation",
                  "type": "response",
                  "status": "success",
                  "timestamp": (now - timedelta(hours=1)).isoformat(),
                  "duration": "0.5s",
                  "user": "user_123",
                  "details": "Generated response with template 'flight_options'",
                  "full_properties": {"template": "flight_options", "tokens": 150}
                }
             ]
             total_count = 5
             
        return {
            "total": total_count,
            "logs": logs
        }
    finally:
        db.close()


@router.get("/analytics/va/nlp/{agent_id}")
async def get_nlp_insights(agent_id: int):
    """
    Get NLP performance metrics for a specific agent
    """
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)
        
        # 1. Intent Accuracy & Distribution
        intent_events = db.query(AgentAnalyticsEvent).filter(
            AgentAnalyticsEvent.agent_id == agent_id,
            AgentAnalyticsEvent.event_type == 'intent',
            AgentAnalyticsEvent.created_at >= week_ago
        ).all()
        
        intent_accuracy = 94.5 # Default/Base
        confidence_scores = []
        
        # Calculate real confidence stats if available
        confidences = []
        for event in intent_events:
            if event.properties and 'confidence' in event.properties:
                try:
                    conf = float(event.properties['confidence'])
                    confidences.append(conf)
                except:
                    pass
        
        if confidences:
            avg_conf = sum(confidences) / len(confidences)
            intent_accuracy = round(avg_conf * 100, 1)
            
            # Buckets
            buckets = {
                "90-100%": 0,
                "80-89%": 0,
                "70-79%": 0,
                "<70%": 0
            }
            
            for conf in confidences:
                if conf >= 0.9: buckets["90-100%"] += 1
                elif conf >= 0.8: buckets["80-89%"] += 1
                elif conf >= 0.7: buckets["70-79%"] += 1
                else: buckets["<70%"] += 1
                
            total_conf = len(confidences)
            confidence_scores = [
                {"range": k, "count": v, "percentage": round((v/total_conf)*100, 1)}
                for k, v in buckets.items()
            ]
        else:
            # Mock if no real data
            confidence_scores = [
                {"range": "90-100%", "count": 3421, "percentage": 68.5},
                {"range": "80-89%", "count": 1245, "percentage": 24.9},
                {"range": "70-79%", "count": 234, "percentage": 4.7},
                {"range": "<70%", "count": 100, "percentage": 2.0},
            ]

        # 2. Entity Extraction
        entity_events = db.query(AgentAnalyticsEvent).filter(
            AgentAnalyticsEvent.agent_id == agent_id,
            AgentAnalyticsEvent.event_type == 'entity',
            AgentAnalyticsEvent.created_at >= week_ago
        ).all()
        
        top_entities = []
        if entity_events:
            entity_counts = {}
            for event in entity_events:
                entity_name = event.event_name
                entity_counts[entity_name] = entity_counts.get(entity_name, 0) + 1
            
            sorted_entities = sorted(entity_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            for ent, count in sorted_entities:
                top_entities.append({
                    "entity": ent,
                    "count": count,
                    "accuracy": 95.0 # Mock accuracy as we don't have ground truth
                })
        else:
            top_entities = [
                {"entity": "location", "count": 1247, "accuracy": 96.2},
                {"entity": "date", "count": 892, "accuracy": 94.5},
                {"entity": "person_name", "count": 456, "accuracy": 91.8},
                {"entity": "amount", "count": 321, "accuracy": 93.1},
                {"entity": "product", "count": 234, "accuracy": 89.5},
            ]

        return {
            "intentAccuracy": intent_accuracy,
            "entityAccuracy": 91.2, # Mock
            "confidenceScores": confidence_scores,
            "topEntities": top_entities,
            "languageDistribution": [
                {"language": "English", "percentage": 78.5},
                {"language": "Spanish", "percentage": 12.3},
                {"language": "French", "percentage": 5.2},
                {"language": "German", "percentage": 2.1},
                {"language": "Other", "percentage": 1.9},
            ]
        }
    finally:
        db.close()


@router.get("/analytics/va/insights/{agent_id}")
async def get_va_insights(agent_id: int):
    """
    Get conversation insights for a specific agent (Sentiment, Intents, Topics, Peak Hours)
    """
    db: Session = SessionLocal()
    try:
        # Date ranges
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)
        
        # 1. Peak Hours (Real Data)
        # Group conversations by hour of day
        conversations = db.query(AgentConversation).filter(
            AgentConversation.agent_id == agent_id,
            AgentConversation.created_at >= week_ago
        ).all()
        
        hours_dist = {i: 0 for i in range(24)}
        for conv in conversations:
            if conv.created_at:
                hours_dist[conv.created_at.hour] += 1
                
        # If no real data, populate hours_dist with mock data for the demo
        if not conversations:
            # Realistic distribution for a business day
            mock_data = {
                9: 145, 10: 189, 11: 234, 12: 156, 13: 140, 
                14: 198, 15: 167, 16: 120, 17: 85, 18: 45
            }
            for h, count in mock_data.items():
                hours_dist[h] = count

        # Format for frontend (Peak Hours Chart)
        peak_hours = []
        for hour in range(24):
            peak_hours.append({
                "hour": f"{hour:02d}:00",
                "conversations": hours_dist[hour]
            })

        # 2. Top Intents (Real Data from Events or Mock)
        # Try to find intent events
        intent_events = db.query(AgentAnalyticsEvent).filter(
            AgentAnalyticsEvent.agent_id == agent_id,
            AgentAnalyticsEvent.event_type == 'intent',
            AgentAnalyticsEvent.created_at >= week_ago
        ).all()
        
        top_intents = []
        if intent_events:
            intent_counts = {}
            for event in intent_events:
                intent_name = event.event_name
                intent_counts[intent_name] = intent_counts.get(intent_name, 0) + 1
            
            # Sort by count
            sorted_intents = sorted(intent_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            for intent, count in sorted_intents:
                top_intents.append({
                    "intent": intent,
                    "count": count,
                    "trend": "up" # simplified
                })
        else:
            # Mock data if no events
            top_intents = [
                {"intent": "book_flight", "count": 342, "trend": "up"},
                {"intent": "check_status", "count": 289, "trend": "up"},
                {"intent": "cancel_booking", "count": 156, "trend": "down"},
                {"intent": "modify_reservation", "count": 134, "trend": "up"},
                {"intent": "get_info", "count": 98, "trend": "stable"},
            ]

        # 3. Sentiment (Mock for now as we don't have NLP analysis yet)
        sentiment = {
            "positive": 78.5,
            "neutral": 18.2,
            "negative": 3.3,
        }

        # 4. Topics (Mock)
        topics = [
            {"topic": "Flight Booking", "mentions": 1247, "sentiment": "positive"},
            {"topic": "Customer Support", "mentions": 892, "sentiment": "neutral"},
            {"topic": "Refunds", "mentions": 456, "sentiment": "negative"},
            {"topic": "Loyalty Program", "mentions": 321, "sentiment": "positive"},
        ]
        
        return {
            "peakHours": peak_hours,
            "topIntents": top_intents,
            "sentiment": sentiment,
            "topics": topics
        }
    finally:
        db.close()


@router.get("/analytics/va/insights/{agent_id}/details")
async def get_insight_details(agent_id: int, type: str, value: str):
    """
    Get detailed drill-down data for a specific insight metric
    """
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)
        
        items = []
        title = f"{value} Details"
        
        if type == "sentiment":
            title = f"{value.title()} Conversations"
            # Since we don't have real sentiment tagging yet, we'll fetch recent conversations
            # and assign them to this sentiment for the demo
            recent_convs = db.query(AgentConversation).filter(
                AgentConversation.agent_id == agent_id
            ).order_by(AgentConversation.created_at.desc()).limit(10).all()
            
            for conv in recent_convs:
                items.append({
                    "id": conv.id,
                    "title": f"Session #{conv.session_id[:8]}",
                    "subtitle": f"User: {conv.user_id or 'Anonymous'}",
                    "value": value,
                    "timestamp": conv.created_at.isoformat() if conv.created_at else None,
                    "metadata": {"duration": "2m 30s", "messages": 5}
                })
                
        elif type == "intent":
            title = f"Conversations with intent: {value}"
            # Find events for this intent
            events = db.query(AgentAnalyticsEvent).filter(
                AgentAnalyticsEvent.agent_id == agent_id,
                AgentAnalyticsEvent.event_type == 'intent',
                AgentAnalyticsEvent.event_name == value
            ).order_by(AgentAnalyticsEvent.created_at.desc()).limit(20).all()
            
            if events:
                for event in events:
                    items.append({
                        "id": event.conversation_id,
                        "title": f"Intent Detected: {value}",
                        "subtitle": f"Confidence: {event.properties.get('confidence', 'N/A')}",
                        "value": value,
                        "timestamp": event.created_at.isoformat() if event.created_at else None,
                        "metadata": event.properties
                    })
            else:
                # Mock if no real events
                for i in range(5):
                    items.append({
                        "id": i,
                        "title": f"Booking Request #{1000+i}",
                        "subtitle": f"Confidence: {0.85 + (i * 0.02)}",
                        "value": value,
                        "timestamp": (now - timedelta(hours=i*2)).isoformat(),
                        "metadata": {"text": f"I want to {value.replace('_', ' ')}"}
                    })

        elif type == "topic":
            title = f"Topic: {value}"
            # Mock topic conversations
            for i in range(5):
                items.append({
                    "id": i,
                    "title": f"Discussion about {value}",
                    "subtitle": "Sentiment: Positive",
                    "value": value,
                    "timestamp": (now - timedelta(days=1, hours=i)).isoformat(),
                    "metadata": {"keywords": [value, "support", "help"]}
                })
        
        elif type == "nlp_entity":
            title = f"Entity: {value}"
            # Find events for this entity
            events = db.query(AgentAnalyticsEvent).filter(
                AgentAnalyticsEvent.agent_id == agent_id,
                AgentAnalyticsEvent.event_type == 'entity',
                AgentAnalyticsEvent.event_name == value
            ).order_by(AgentAnalyticsEvent.created_at.desc()).limit(20).all()
            
            if events:
                for event in events:
                    items.append({
                        "id": event.conversation_id,
                        "title": f"Entity Extracted: {value}",
                        "subtitle": f"Value: {event.properties.get('value', 'N/A')}",
                        "value": value,
                        "timestamp": event.created_at.isoformat() if event.created_at else None,
                        "metadata": event.properties
                    })
            else:
                # Mock
                for i in range(5):
                    items.append({
                        "id": i,
                        "title": f"Extracted {value}",
                        "subtitle": f"Confidence: 0.9{i}",
                        "value": value,
                        "timestamp": (now - timedelta(hours=i*3)).isoformat(),
                        "metadata": {"text": f"I want to go to {value} location"}
                    })

        elif type == "nlp_confidence":
            title = f"Confidence Range: {value}"
            # This is hard to query exactly without range filtering in SQL, 
            # so we'll fetch recent intent events and filter in python or mock
            items = []
            min_conf = 0.0
            max_conf = 1.0
            
            if value == "90-100%": min_conf = 0.9
            elif value == "80-89%": min_conf, max_conf = 0.8, 0.9
            elif value == "70-79%": min_conf, max_conf = 0.7, 0.8
            else: max_conf = 0.7
            
            # Fetch recent intents
            events = db.query(AgentAnalyticsEvent).filter(
                AgentAnalyticsEvent.agent_id == agent_id,
                AgentAnalyticsEvent.event_type == 'intent'
            ).order_by(AgentAnalyticsEvent.created_at.desc()).limit(50).all()
            
            count = 0
            for event in events:
                if count >= 10: break
                conf = float(event.properties.get('confidence', 0))
                if min_conf <= conf < max_conf or (max_conf == 1.0 and conf == 1.0):
                    items.append({
                        "id": event.conversation_id,
                        "title": f"Intent: {event.event_name}",
                        "subtitle": f"Confidence: {conf:.2f}",
                        "value": value,
                        "timestamp": event.created_at.isoformat(),
                        "metadata": event.properties
                    })
                    count += 1
            
            if not items:
                 for i in range(5):
                    items.append({
                        "id": i,
                        "title": f"Intent Recognition",
                        "subtitle": f"Confidence: {min_conf + 0.05:.2f}",
                        "value": value,
                        "timestamp": (now - timedelta(hours=i)).isoformat(),
                        "metadata": {"input": "User query example"}
                    })
                
        elif type == "hour":
            title = f"Activity at {value}"
            try:
                hour = int(value.split(':')[0])
                # Get conversations started in this hour (across last 7 days)
                # This is a bit complex in SQL for "hour of day", so we'll fetch recent and filter in python or just mock
                # Simple mock for speed/reliability of demo
                for i in range(8):
                    items.append({
                        "id": i,
                        "title": f"Session started at {value}",
                        "subtitle": "Active user",
                        "value": f"{hour}:{(i*7)%60:02d}",
                        "timestamp": (now - timedelta(days=i)).replace(hour=hour, minute=(i*7)%60).isoformat(),
                        "metadata": {"duration": f"{1+i}m"}
                    })
            except:
                pass

        return {
            "type": type,
            "title": title,
            "items": items
        }
    except Exception as e:
        logger.error(f"Error fetching insight details: {str(e)}")
        # Return empty safe response
        return {"type": type, "title": "Error loading details", "items": []}
    finally:
        db.close()


@router.get("/analytics/va/performance/{agent_id}")
async def get_va_performance(agent_id: int):
    """
    Get performance metrics for a specific agent
    """
    db: Session = SessionLocal()
    try:
        # Date ranges
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)
        
        # 1. Total Conversations (Real)
        total_conversations = db.query(AgentConversation).filter(
            AgentConversation.agent_id == agent_id
        ).count()
        
        # 2. Avg Response Time (Mock/Real mix)
        # We would need message timestamps to calc this accurately
        avg_response_time = 1.2 # Mock default
        
        # 3. Success Rate (Based on 'error' events vs total sessions)
        total_sessions_week = db.query(AgentConversation).filter(
            AgentConversation.agent_id == agent_id,
            AgentConversation.created_at >= week_ago
        ).count()
        
        error_events = db.query(AgentAnalyticsEvent).filter(
            AgentAnalyticsEvent.agent_id == agent_id,
            AgentAnalyticsEvent.event_type == 'error',
            AgentAnalyticsEvent.created_at >= week_ago
        ).count()
        
        success_rate = 98.5 # Default high
        if total_sessions_week > 0:
            # Simple formula: (sessions - errors) / sessions
            # Note: One session might have multiple errors, so max(0, ...)
            clean_sessions = max(0, total_sessions_week - error_events)
            success_rate = round((clean_sessions / total_sessions_week) * 100, 1)

        # 4. Active Users (Unique user_ids)
        active_users = db.query(AgentConversation.user_id).filter(
            AgentConversation.agent_id == agent_id,
            AgentConversation.created_at >= week_ago,
            AgentConversation.user_id.isnot(None)
        ).distinct().count()
        
        if active_users == 0:
            active_users = 342 # Fallback mock

        # 5. Conversation Volume (Last 7 Days)
        conversation_volume = []
        for i in range(7):
            day_date = (now - timedelta(days=6-i)).date()
            day_start = datetime.combine(day_date, datetime.min.time())
            day_end = datetime.combine(day_date, datetime.max.time())
            
            count = db.query(AgentConversation).filter(
                AgentConversation.agent_id == agent_id,
                AgentConversation.created_at >= day_start,
                AgentConversation.created_at <= day_end
            ).count()
            
            conversation_volume.append({
                "name": day_date.strftime("%a"),
                "value": count
            })
            
        # If no volume, mock it for demo
        if sum(d["value"] for d in conversation_volume) == 0:
             conversation_volume = [
                {"name": 'Mon', "value": 120},
                {"name": 'Tue', "value": 132},
                {"name": 'Wed', "value": 101},
                {"name": 'Thu', "value": 134},
                {"name": 'Fri', "value": 190},
                {"name": 'Sat', "value": 230},
                {"name": 'Sun', "value": 210},
            ]

        # 6. Response Time Distribution (Mock for now)
        response_time_distribution = [
            {"range": '0-0.5s', "count": 400},
            {"range": '0.5-1.0s', "count": 300},
            {"range": '1.0-1.5s', "count": 200},
            {"range": '1.5-2.0s', "count": 150},
            {"range": '>2.0s', "count": 100},
        ]

        # 7. Task Breakdown (Mock for now, but structured)
        task_breakdown = [
            { 
                "type": "Intent Recognition", 
                "count": 3421, 
                "success": 96.2, 
                "time": "0.8s", 
                "trend": "up", 
                "subItems": [
                    {"label": "BookFlight", "count": 842, "success": 98},
                    {"label": "CheckBalance", "count": 621, "success": 97},
                    {"label": "ContactSupport", "count": 412, "success": 95}
                ] 
            },
            { 
                "type": "Entity Extraction", 
                "count": 2891, 
                "success": 94.5, 
                "time": "1.1s", 
                "trend": "up", 
                "subItems": [
                    {"label": "Date", "count": 1205, "success": 96},
                    {"label": "Location", "count": 890, "success": 93},
                    {"label": "PersonName", "count": 540, "success": 95}
                ] 
            },
            { 
                "type": "API Calls", 
                "count": 1923, 
                "success": 98.1, 
                "time": "2.3s", 
                "trend": "down", 
                "subItems": [
                    {"label": "WeatherAPI", "count": 800, "success": 99},
                    {"label": "PaymentGateway", "count": 650, "success": 98},
                    {"label": "CRM_Sync", "count": 473, "success": 97}
                ] 
            }
        ]

        return {
            "totalConversations": total_conversations if total_conversations > 0 else 1247,
            "avgResponseTime": avg_response_time,
            "successRate": success_rate,
            "userSatisfaction": 4.6, # Mock
            "activeUsers": active_users,
            "tasksCompleted": 8921, # Mock
            "errorRate": 100 - success_rate,
            "avgSessionDuration": 8.5, # Mock
            "conversationVolume": conversation_volume,
            "responseTimeDistribution": response_time_distribution,
            "taskBreakdown": task_breakdown
        }
    finally:
        db.close()


@router.get("/analytics/overview")
async def get_analytics_overview():
    """
    Get comprehensive analytics data
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
        
        # Node Engine Performance (Last 30 Days)
        exit_events = db.query(AgentAnalyticsEvent).filter(
            and_(
                AgentAnalyticsEvent.event_type == 'node_exit',
                AgentAnalyticsEvent.created_at >= month_ago
            )
        ).all()
        
        total_duration = 0
        duration_count = 0
        node_error_count = 0
        
        for event in exit_events:
            props = event.properties or {}
            try:
                duration = float(props.get("duration_ms", 0))
            except (ValueError, TypeError):
                duration = 0
                
            status = props.get("status", "success")
            
            if duration > 0:
                total_duration += duration
                duration_count += 1
                
            if status in ["error", "exception"]:
                node_error_count += 1
                
        avg_execution_time = (total_duration / duration_count) if duration_count > 0 else 0
        node_error_rate = (node_error_count / len(exit_events) * 100) if exit_events else 0
        
        # Calculate SLA metricssolving rate
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
        
        result = {
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
                "avg_execution_time": round(avg_execution_time, 2),
                "error_rate": round(node_error_rate, 2),
                "total_errors": node_error_count
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


@router.get("/analytics/agents/overview")
async def get_agents_overview(days: int = 30):
    """
    Get high-level overview of all agents performance
    """
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        start_date = now - timedelta(days=days)
        
        # Total active agents
        total_agents = db.query(Agent).count()
        active_agents = db.query(Agent).filter(Agent.is_active == True).count()
        
        # Total executions (events of type 'node_entry' for entry nodes or just total events)
        total_executions = db.query(AgentAnalyticsEvent).filter(
            and_(
                AgentAnalyticsEvent.event_type == 'node_entry', # Assuming node_entry approximates execution steps
                AgentAnalyticsEvent.created_at >= start_date
            )
        ).count()
        
        # Calculate performance metrics from node_exit events
        exit_events = db.query(AgentAnalyticsEvent).filter(
            and_(
                AgentAnalyticsEvent.event_type == 'node_exit',
                AgentAnalyticsEvent.created_at >= start_date
            )
        ).all()
        
        total_duration = 0
        duration_count = 0
        error_count = 0
        
        for event in exit_events:
            props = event.properties or {}
            # Handle potential string values or missing keys safely
            try:
                duration = float(props.get("duration_ms", 0))
            except (ValueError, TypeError):
                duration = 0
                
            status = props.get("status", "success")
            
            if duration > 0:
                total_duration += duration
                duration_count += 1
                
            if status in ["error", "exception"]:
                error_count += 1
                
        avg_execution_time = (total_duration / duration_count) if duration_count > 0 else 0
        error_rate = (error_count / len(exit_events) * 100) if exit_events else 0
        
        # Top active agents by event count
        top_agents = db.query(
            Agent.name,
            func.count(AgentAnalyticsEvent.id).label('event_count')
        ).join(
            AgentAnalyticsEvent, Agent.id == AgentAnalyticsEvent.agent_id
        ).filter(
            AgentAnalyticsEvent.created_at >= start_date
        ).group_by(Agent.id, Agent.name).order_by(func.count(AgentAnalyticsEvent.id).desc()).limit(5).all()
        
        return {
            "total_agents": total_agents,
            "active_agents": active_agents,
            "total_executions_last_30d": total_executions,
            "avg_execution_time_ms": round(avg_execution_time, 2),
            "error_rate": round(error_rate, 2),
            "total_errors": error_count,
            "top_agents": [{"name": name, "events": count} for name, count in top_agents]
        }
    except Exception as e:
        logger.error(f"Error fetching agents overview: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch agents overview: {str(e)}")
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


@router.get("/analytics/agent/{agent_id}/events")
async def get_agent_events(agent_id: int, limit: int = 100, skip: int = 0):
    """
    Get raw analytics events for a specific agent
    """
    db: Session = SessionLocal()
    try:
        events = db.query(AgentAnalyticsEvent).filter(
            AgentAnalyticsEvent.agent_id == agent_id
        ).order_by(AgentAnalyticsEvent.created_at.desc()).offset(skip).limit(limit).all()
        
        return events
    except Exception as e:
        logger.error(f"Error fetching agent events: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch agent events: {str(e)}")
    finally:
        db.close()


@router.get("/analytics/agent/{agent_id}/stats")
async def get_agent_stats(agent_id: int, days: int = 30):
    """
    Get aggregated statistics for a specific agent
    """
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        start_date = now - timedelta(days=days)
        
        # Total events in period
        total_events = db.query(AgentAnalyticsEvent).filter(
            and_(
                AgentAnalyticsEvent.agent_id == agent_id,
                AgentAnalyticsEvent.created_at >= start_date
            )
        ).count()
        
        # Events by type
        events_by_type = db.query(
            AgentAnalyticsEvent.event_type,
            func.count(AgentAnalyticsEvent.id).label('count')
        ).filter(
            and_(
                AgentAnalyticsEvent.agent_id == agent_id,
                AgentAnalyticsEvent.created_at >= start_date
            )
        ).group_by(AgentAnalyticsEvent.event_type).all()
        
        type_distribution = {etype: count for etype, count in events_by_type}
        
        # Error tracking
        error_count = type_distribution.get("error", 0) + type_distribution.get("node_error", 0)
        error_rate = (error_count / total_events * 100) if total_events > 0 else 0
        
        # Conversation counts (unique conversation_ids)
        total_conversations = db.query(func.count(func.distinct(AgentAnalyticsEvent.conversation_id))).filter(
            and_(
                AgentAnalyticsEvent.agent_id == agent_id,
                AgentAnalyticsEvent.created_at >= start_date
            )
        ).scalar()
        
        # Activity over time (daily)
        activity_data = []
        for i in range(days):
            date = (start_date + timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            date_end = date + timedelta(days=1)
            
            daily_count = db.query(AgentAnalyticsEvent).filter(
                and_(
                    AgentAnalyticsEvent.agent_id == agent_id,
                    AgentAnalyticsEvent.created_at >= date,
                    AgentAnalyticsEvent.created_at < date_end
                )
            ).count()
            
            activity_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "count": daily_count
            })
            
        return {
            "period_days": days,
            "total_events": total_events,
            "total_conversations": total_conversations,
            "type_distribution": type_distribution,
            "error_rate": round(error_rate, 2),
            "activity_timeline": activity_data
        }
    except Exception as e:
        logger.error(f"Error fetching agent stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch agent stats: {str(e)}")
    finally:
        db.close()


class CustomAnalyticsRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    metrics: List[str] = ["count"]
    group_by: str = "day"  # day, hour, type, status
    filters: Optional[Dict[str, Any]] = None

@router.post("/analytics/va/custom/{agent_id}")
async def get_custom_analytics(
    agent_id: int,
    request: CustomAnalyticsRequest
):
    """
    Get custom analytics data based on dynamic criteria
    """
    db: Session = SessionLocal()
    try:
        query = db.query(AgentAnalyticsEvent).filter(
            AgentAnalyticsEvent.agent_id == agent_id
        )
        
        # Apply Date Range
        if request.start_date:
            query = query.filter(AgentAnalyticsEvent.created_at >= request.start_date)
        if request.end_date:
            query = query.filter(AgentAnalyticsEvent.created_at <= request.end_date)
            
        # Apply Filters
        if request.filters:
            if 'status' in request.filters and request.filters['status'] != 'all':
                if request.filters['status'] == 'error':
                     query = query.filter(AgentAnalyticsEvent.event_type.in_(['error', 'exception']))
                elif request.filters['status'] == 'success':
                     query = query.filter(AgentAnalyticsEvent.event_type.notin_(['error', 'exception']))
            if 'event_type' in request.filters and request.filters['event_type']:
                 query = query.filter(AgentAnalyticsEvent.event_name.ilike(f"%{request.filters['event_type']}%"))

        # Fetch data for python-side aggregation (simpler for dynamic grouping)
        events = query.all()
        data = []
        
        if request.group_by == "day":
            grouped = {}
            for e in events:
                if not e.created_at: continue
                key = e.created_at.strftime("%Y-%m-%d")
                grouped[key] = grouped.get(key, 0) + 1
            data = [{"key": k, "value": v} for k, v in sorted(grouped.items())]
            
        elif request.group_by == "type":
            grouped = {}
            for e in events:
                key = e.event_type or "unknown"
                grouped[key] = grouped.get(key, 0) + 1
            data = [{"key": k, "value": v} for k, v in sorted(grouped.items(), key=lambda x: x[1], reverse=True)]
            
        elif request.group_by == "status":
             grouped = {"success": 0, "error": 0}
             for e in events:
                 status = "error" if e.event_type in ['error', 'exception'] else "success"
                 grouped[status] += 1
             data = [{"key": k, "value": v} for k, v in grouped.items()]
        
        # Fallback Mock Data if empty (for demo)
        if not data and not events:
            if request.group_by == "day":
                now = datetime.utcnow()
                data = []
                for i in range(7):
                    d = now - timedelta(days=6-i)
                    val = int((i * 13 + 7) % 40) + 10
                    data.append({"key": d.strftime("%Y-%m-%d"), "value": val})
            elif request.group_by == "type":
                data = [
                    {"key": "intent_recognition", "value": 150},
                    {"key": "entity_extraction", "value": 120},
                    {"key": "api_call", "value": 80},
                    {"key": "response_generation", "value": 200},
                    {"key": "error", "value": 5}
                ]
            elif request.group_by == "status":
                data = [
                    {"key": "success", "value": 450},
                    {"key": "error", "value": 15}
                ]

        return {
            "data": data,
            "metrics": {"total_events": sum(d['value'] for d in data)}
        }
    finally:
        db.close()


@router.get("/analytics/va/logs/{agent_id}")
async def get_task_execution_logs(
    agent_id: int,
    status: str = "all",
    limit: int = 50,
    offset: int = 0
):
    """
    Get task execution logs (AgentAnalyticsEvents) for a specific agent
    """
    db: Session = SessionLocal()
    try:
        query = db.query(AgentAnalyticsEvent).filter(
            AgentAnalyticsEvent.agent_id == agent_id
        )
        
        if status != "all":
            if status == "error":
                query = query.filter(AgentAnalyticsEvent.event_type.in_(['error', 'exception']))
            elif status == "success":
                 query = query.filter(AgentAnalyticsEvent.event_type.notin_(['error', 'exception']))
        
        total_count = query.count()
        
        events = query.order_by(AgentAnalyticsEvent.created_at.desc())\
                      .offset(offset).limit(limit).all()
        
        logs = []
        for event in events:
            # Try to get user info if conversation_id exists
            user_id = "Unknown"
            if event.conversation_id:
                conv = db.query(AgentConversation).filter(AgentConversation.id == event.conversation_id).first()
                if conv and conv.user_id:
                    user_id = str(conv.user_id)
            
            # Determine status
            log_status = "success"
            if event.event_type in ['error', 'exception']:
                log_status = "error"
                
            # Determine duration (mock if not present)
            duration = "0.5s" # Default
            if event.properties:
                if 'duration_ms' in event.properties:
                    try:
                        duration = f"{float(event.properties['duration_ms'])/1000:.2f}s"
                    except:
                        pass
                elif 'duration' in event.properties:
                    duration = str(event.properties['duration'])
            
            logs.append({
                "id": event.id,
                "task": event.event_name,
                "type": event.event_type,
                "status": log_status,
                "timestamp": event.created_at.isoformat() if event.created_at else None,
                "duration": duration,
                "user": user_id,
                "details": str(event.properties),
                "full_properties": event.properties
            })
            
        # If no logs, return mock data for demo purposes
        if not logs and offset == 0:
             now = datetime.utcnow()
             logs = [
                {
                  "id": 1,
                  "task": "Intent Recognition",
                  "type": "intent",
                  "status": "success",
                  "timestamp": (now - timedelta(minutes=5)).isoformat(),
                  "duration": "0.8s",
                  "user": "user_123",
                  "details": "Recognized intent: 'book_flight' with 95% confidence",
                  "full_properties": {"confidence": 0.95, "intent": "book_flight", "input": "I want to book a flight"}
                },
                {
                  "id": 2,
                  "task": "Entity Extraction",
                  "type": "entity",
                  "status": "success",
                  "timestamp": (now - timedelta(minutes=4)).isoformat(),
                  "duration": "0.3s",
                  "user": "user_123",
                  "details": "Extracted entities: {'destination': 'London', 'date': 'tomorrow'}",
                  "full_properties": {"entities": [{"entity": "destination", "value": "London"}, {"entity": "date", "value": "tomorrow"}]}
                },
                {
                  "id": 3,
                  "task": "API Call (Flight Search)",
                  "type": "api_call",
                  "status": "success",
                  "timestamp": (now - timedelta(minutes=3)).isoformat(),
                  "duration": "1.2s",
                  "user": "user_123",
                  "details": "Searching flights to London",
                  "full_properties": {"url": "https://api.airlines.com/search", "method": "GET", "params": {"to": "LHR"}}
                },
                {
                  "id": 4,
                  "task": "Response Generation",
                  "type": "response",
                  "status": "success",
                  "timestamp": (now - timedelta(minutes=2)).isoformat(),
                  "duration": "0.5s",
                  "user": "user_123",
                  "details": "Generated response with flight options",
                  "full_properties": {"response_template": "flight_options", "count": 3}
                },
                {
                  "id": 5,
                  "task": "Payment Processing",
                  "type": "payment",
                  "status": "error",
                  "timestamp": (now - timedelta(minutes=1)).isoformat(),
                  "duration": "2.5s",
                  "user": "user_123",
                  "details": "Payment gateway timeout",
                  "full_properties": {"error_code": "TIMEOUT", "gateway": "stripe", "attempt": 1}
                }
             ]
             if status == "error":
                 logs = [l for l in logs if l["status"] == "error"]
             elif status == "success":
                 logs = [l for l in logs if l["status"] == "success"]
                 
             total_count = len(logs)
            
        return {
            "total": total_count,
            "logs": logs
        }
    finally:
        db.close()
