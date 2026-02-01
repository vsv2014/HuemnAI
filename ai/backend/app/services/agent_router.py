from app.services.status_service import get_available_agents, get_agent_status
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

def select_best_agent(priority: str = "medium", required_skills: Optional[list] = None) -> Optional[str]:
    """
    Select the best agent for a ticket based on:
    - Availability (online, not away)
    - Current workload (open ticket count)
    - Skills match (if required_skills provided)
    - Priority handling capability
    """
    agents = get_available_agents()
    
    if not agents:
        logger.warning("No available agents found")
        return None
    
    # Filter agents by status - must be online and not away
    available = []
    for agent in agents:
        status_data = get_agent_status(agent["id"])
        if not status_data:
            continue
        
        # Skip if offline, away, or busy (unless urgent priority)
        agent_status = status_data.get("status", "offline")
        if agent_status == "offline":
            continue
        if agent_status == "away" and priority != "urgent":
            continue
        if agent_status == "busy" and priority not in ["high", "urgent"]:
            continue
        
        available.append(agent)
    
    if not available:
        # If no agents match strict criteria, try to find any online agent
        for agent in agents:
            status_data = get_agent_status(agent["id"])
            if status_data and status_data.get("status") == "online":
                available.append(agent)
                break
    
    if not available:
        # FALLBACK: If still no agents (e.g. dev environment or everyone offline),
        # pick the agent with the lowest workload to ensure assignment happens.
        logger.warning("No online agents found. Using fallback assignment.")
        # Sort all agents by workload
        agents_by_load = sorted(agents, key=lambda a: a.get("open_ticket_count", 0))
        if agents_by_load:
            available.append(agents_by_load[0])
            
    if not available:
        logger.warning("No suitable agents available after filtering")
        return None
    
    # Score agents based on multiple factors
    scored_agents = []
    for agent in available:
        score = 0
        
        # Lower workload = higher score
        open_count = agent.get("open_ticket_count", 0)
        max_load = agent.get("max_ticket_load", 10)
        workload_ratio = open_count / max(max_load, 1)
        score += (1.0 - workload_ratio) * 50  # Up to 50 points
        
        # Skills match (if required)
        if required_skills:
            agent_skills = agent.get("skills", [])
            if agent_skills:
                skill_match = len(set(required_skills) & set(agent_skills)) / len(required_skills)
                score += skill_match * 30  # Up to 30 points
        
        # Priority handling bonus
        if priority == "urgent":
            # Prefer agents with lower current load for urgent
            score += (1.0 - workload_ratio) * 20
        elif priority == "high":
            score += (1.0 - workload_ratio) * 10
        
        # Recent activity bonus (agents active recently get slight boost)
        last_seen = agent.get("last_seen", 0)
        import time
        time_since_seen = time.time() - last_seen
        if time_since_seen < 300:  # Active in last 5 minutes
            score += 5
        
        scored_agents.append((score, agent))
    
    # Sort by score (highest first)
    scored_agents.sort(key=lambda x: x[0], reverse=True)
    
    if scored_agents:
        best_agent = scored_agents[0][1]
        logger.info(f"Selected agent {best_agent['id']} with score {scored_agents[0][0]:.2f}")
        return best_agent["id"]
    
    return None

def reassign_ticket_if_needed(ticket_id: int) -> Optional[str]:
    """
    Check if assigned agent is still available, if not, reassign to next best agent.
    Returns new agent ID if reassigned, None otherwise.
    """
    from app.db.session import SessionLocal
    from app.db.models.ticket import Ticket
    
    db = SessionLocal()
    try:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket or ticket.status != "open":
            return None
        
        current_agent = ticket.assigned_to
        if not current_agent:
            # No agent assigned, assign one
            new_agent = select_best_agent(ticket.priority)
            if new_agent:
                ticket.assigned_to = new_agent
                db.commit()
                return new_agent
            return None
        
        # Check if current agent is still available
        status_data = get_agent_status(current_agent)
        if not status_data:
            # Agent not found, reassign
            new_agent = select_best_agent(ticket.priority)
            if new_agent:
                ticket.assigned_to = new_agent
                db.commit()
                logger.info(f"Reassigned ticket {ticket_id} from {current_agent} to {new_agent}")
                return new_agent
            return None
        
        agent_status = status_data.get("status", "offline")
        if agent_status in ["offline", "away"]:
            # Agent unavailable, reassign
            new_agent = select_best_agent(ticket.priority)
            if new_agent and new_agent != current_agent:
                ticket.assigned_to = new_agent
                db.commit()
                logger.info(f"Reassigned ticket {ticket_id} from {current_agent} ({agent_status}) to {new_agent}")
                return new_agent
        
        return None  # Current agent is still suitable
    finally:
        db.close()
