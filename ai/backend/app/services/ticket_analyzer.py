"""
Ticket Analyzer Service
Analyzes incoming tickets, finds similar previous tickets, and generates responses
based on historical ticket resolutions.
"""
from typing import List, Dict, Optional, Tuple
from app.db.session import SessionLocal
from app.db.models.ticket import Ticket
from app.services.embeddings_service import get_embedding, cosine_similarity
import logging

logger = logging.getLogger(__name__)


def find_similar_tickets(
    query: str,
    limit: int = 5,
    min_similarity: float = 0.7
) -> List[Dict]:
    """
    Find similar tickets from the database based on query similarity.
    Returns list of similar tickets with similarity scores.
    """
    db = SessionLocal()
    try:
        # Get query embedding
        try:
            query_embedding = get_embedding(query)
            if not query_embedding:
                logger.warning("Failed to get query embedding, returning empty results")
                return []
        except Exception as e:
            logger.error(f"Error getting query embedding: {e}", exc_info=True)
            return []
        
        # Get all resolved tickets with descriptions
        tickets = db.query(Ticket).filter(
            Ticket.status.in_(["resolved", "closed"]),
            Ticket.description.isnot(None)
        ).all()
        
        similar_tickets = []
        
        for ticket in tickets:
            # Get ticket text for comparison
            ticket_text = f"{ticket.title or ''} {ticket.description or ''}"
            
            # Get ticket embedding
            try:
                ticket_embedding = get_embedding(ticket_text)
                if not ticket_embedding:
                    continue
            except Exception as e:
                logger.debug(f"Error getting embedding for ticket {ticket.id}: {e}")
                continue
            
            # Calculate similarity
            similarity = cosine_similarity(query_embedding, ticket_embedding)
            
            if similarity >= min_similarity:
                similar_tickets.append({
                    "ticket_id": ticket.id,
                    "title": ticket.title,
                    "description": ticket.description,
                    "status": ticket.status,
                    "priority": ticket.priority,
                    "similarity": similarity,
                    "troubleshooting_steps": ticket.troubleshooting_steps,
                    "customer_info": ticket.customer_info,
                    "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None
                })
        
        # Sort by similarity (highest first)
        similar_tickets.sort(key=lambda x: x["similarity"], reverse=True)
        
        return similar_tickets[:limit]
    
    except Exception as e:
        logger.error(f"Error finding similar tickets: {e}", exc_info=True)
        return []
    finally:
        db.close()


def generate_response_from_history(
    query: str,
    similar_tickets: List[Dict],
    conversation_history: List[Dict] = None
) -> Dict:
    """
    Generate a response based on similar previous tickets.
    Returns response text and relevant information.
    """
    if not similar_tickets:
        return {
            "response": None,
            "is_similar": False,
            "confidence": 0.0,
            "suggested_questions": []
        }
    
    # Get the most similar ticket
    best_match = similar_tickets[0]
    similarity_score = best_match["similarity"]
    
    # If similarity is very high (>0.9), we can provide a direct solution
    if similarity_score > 0.9:
        # Extract solution from troubleshooting steps or description
        solution = ""
        if best_match.get("troubleshooting_steps"):
            steps = best_match["troubleshooting_steps"]
            if isinstance(steps, list) and len(steps) > 0:
                solution = "Based on a similar issue we've resolved before, here's what worked:\n\n"
                for i, step in enumerate(steps, 1):
                    solution += f"{i}. {step}\n"
        
        return {
            "response": solution or f"We've seen a similar issue before (Ticket #{best_match['ticket_id']}). Let me help you with this.",
            "is_similar": True,
            "confidence": similarity_score,
            "similar_ticket_id": best_match["ticket_id"],
            "suggested_questions": _generate_questions_from_history(best_match, similar_tickets[1:3])
        }
    
    # If similarity is moderate (0.7-0.9), ask clarifying questions based on history
    elif similarity_score >= 0.7:
        questions = _generate_questions_from_history(best_match, similar_tickets[1:3])
        
        return {
            "response": f"This looks similar to a previous issue (Ticket #{best_match['ticket_id']}). Let me ask a few questions to better understand your situation.",
            "is_similar": True,
            "confidence": similarity_score,
            "similar_ticket_id": best_match["ticket_id"],
            "suggested_questions": questions
        }
    
    return {
        "response": None,
        "is_similar": False,
        "confidence": similarity_score,
        "suggested_questions": []
    }


def _generate_questions_from_history(
    best_match: Dict,
    other_similar: List[Dict] = None
) -> List[str]:
    """
    Generate relevant questions based on similar ticket history.
    """
    questions = []
    
    # Extract common patterns from similar tickets
    if best_match.get("customer_info"):
        customer_info = best_match["customer_info"]
        if isinstance(customer_info, dict):
            # If previous tickets asked about specific things, ask similar questions
            if "error_message" in customer_info and not customer_info.get("error_message"):
                questions.append("What specific error message are you seeing?")
            if "device_info" in customer_info and not customer_info.get("device_info"):
                questions.append("What device or browser are you using?")
            if "start_time" in customer_info and not customer_info.get("start_time"):
                questions.append("When did this issue first occur?")
    
    # Add questions based on ticket type
    title_lower = (best_match.get("title") or "").lower()
    if "login" in title_lower or "password" in title_lower:
        questions.extend([
            "Are you able to access the password reset page?",
            "When did you last successfully log in?"
        ])
    elif "payment" in title_lower or "billing" in title_lower:
        questions.extend([
            "What is the transaction ID or reference number?",
            "When did this payment issue occur?"
        ])
    elif "error" in title_lower or "broken" in title_lower:
        questions.extend([
            "What steps can we take to reproduce this issue?",
            "Have you tried any troubleshooting steps already?"
        ])
    
    # Remove duplicates and limit
    seen = set()
    unique_questions = []
    for q in questions:
        if q not in seen:
            seen.add(q)
            unique_questions.append(q)
            if len(unique_questions) >= 3:
                break
    
    return unique_questions


def check_user_impact(description: str, conversation_history: List[Dict] = None) -> Dict:
    """
    Check if the issue has user impact to validate high severity.
    Returns impact assessment.
    """
    description_lower = description.lower()
    full_context = description_lower
    
    if conversation_history:
        full_context += " " + " ".join([msg.get("text", "").lower() for msg in conversation_history])
    
    # High impact indicators
    high_impact_keywords = [
        "users affected", "multiple users", "all users", "everyone",
        "production down", "service unavailable", "cannot access",
        "complete outage", "system wide", "affecting customers",
        "business critical", "revenue impact", "data loss"
    ]
    
    # Low/no impact indicators
    low_impact_keywords = [
        "only me", "just me", "personal", "my account only",
        "test environment", "staging", "development",
        "cosmetic", "minor", "small issue", "not urgent"
    ]
    
    has_high_impact = any(keyword in full_context for keyword in high_impact_keywords)
    has_low_impact = any(keyword in full_context for keyword in low_impact_keywords)
    
    # Count mentions of users/people
    user_mentions = sum(1 for keyword in ["user", "customer", "client", "person"] if keyword in full_context)
    
    impact_level = "unknown"
    if has_high_impact or user_mentions > 3:
        impact_level = "high"
    elif has_low_impact:
        impact_level = "low"
    elif user_mentions > 0:
        impact_level = "medium"
    
    return {
        "has_user_impact": impact_level in ["high", "medium"],
        "impact_level": impact_level,
        "user_mentions": user_mentions,
        "requires_verification": impact_level == "unknown" and "high" in description_lower or "urgent" in description_lower
    }


def adjust_severity_based_on_impact(
    current_severity: str,
    impact_assessment: Dict
) -> Tuple[str, str]:
    """
    Adjust severity based on user impact assessment.
    Returns (new_severity, adjustment_reason)
    """
    if current_severity != "high":
        return current_severity, ""
    
    # If severity is high but no user impact, downgrade
    if not impact_assessment.get("has_user_impact"):
        if impact_assessment.get("impact_level") == "low":
            return "medium", "The issue has been downgraded from HIGH to MEDIUM severity as it appears to affect only you and not other users. This helps us prioritize tickets that impact multiple users."
        elif impact_assessment.get("impact_level") == "unknown":
            return "high", "We've marked this as HIGH priority. If this issue only affects you and not other users, please let us know and we can adjust the priority."
    
    return current_severity, ""

