from typing import List, Dict, Tuple, Optional
from threading import Thread
import time
import logging
from app.services.connectors import jira, zendesk, salesforce
from app.services.embeddings_service import get_embedding, cosine_similarity
from app.services.llm_service import explain

logger = logging.getLogger(__name__)

# Enhanced knowledge index with full ticket content
TICKET_INDEX: List[Dict] = []
TICKET_VECS: List[Tuple[Dict, List[float]]] = []

# Store solutions and resolutions for learning
TICKET_SOLUTIONS: Dict[str, str] = {}  # ticket_id -> solution


def index_all_connectors():
    """Index all tickets from all connectors with full content"""
    global TICKET_INDEX, TICKET_VECS
    combined = []
    
    try:
        # Fetch from all connectors
        combined.extend(jira.fetch_tickets())
        combined.extend(zendesk.fetch_tickets())
        # Salesforce cases
        try:
            salesforce_cases = salesforce.fetch_cases()
            combined.extend([{
                "id": c.get("id", ""),
                "title": c.get("subject", ""),
                "body": c.get("description", ""),
                "status": c.get("status", ""),
                "solution": c.get("solution", ""),
                "resolution": c.get("resolution", "")
            } for c in salesforce_cases])
        except Exception as e:
            logger.warning(f"Error fetching Salesforce cases: {e}")
    except Exception as e:
        logger.error(f"Error fetching tickets from connectors: {e}")
    
    # Also fetch from database tickets
    try:
        from app.db.session import SessionLocal
        from app.db.models.ticket import Ticket
        db = SessionLocal()
        try:
            db_tickets = db.query(Ticket).filter(Ticket.status == "resolved").all()
            for ticket in db_tickets:
                combined.append({
                    "id": f"DB-{ticket.id}",
                    "title": ticket.title or "Ticket",
                    "body": ticket.description or "",
                    "status": ticket.status,
                    "solution": str(ticket.troubleshooting_steps) if ticket.troubleshooting_steps else "",
                    "resolution": "resolved"
                })
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Error fetching database tickets: {e}")
    
    # De-dup by id
    seen = set()
    out = []
    for t in combined:
        ticket_id = t.get("id", "")
        if not ticket_id or ticket_id in seen:
            continue
        seen.add(ticket_id)
        
        # Store solution if available
        if t.get("solution") or t.get("resolution"):
            solution_text = f"{t.get('solution', '')} {t.get('resolution', '')}".strip()
            if solution_text:
                TICKET_SOLUTIONS[ticket_id] = solution_text
        
        out.append(t)
    
    # If no tickets found, add sample data
    if not out:
        out = [{
            "id": "SAMPLE-1",
            "title": "Sample ticket",
            "body": "This is a sample ticket used for testing. Common issues include login problems, payment errors, and email delivery issues.",
            "status": "resolved",
            "solution": "Check credentials and try password reset if needed."
        }]
    
    # Update index
    TICKET_INDEX.clear()
    TICKET_INDEX.extend(out)
    
    # Build embeddings with full content (title + body + solution)
    TICKET_VECS.clear()
    for t in TICKET_INDEX:
        # Include full content for better semantic matching
        title = t.get('title', '')
        body = t.get('body', '')
        solution = t.get('solution', '')
        status = t.get('status', '')
        
        # Combine all text for embedding
        full_text = f"{title} {body} {solution} {status}".strip()
        
        if full_text:
            try:
                vec = get_embedding(full_text)
                TICKET_VECS.append((t, vec))
            except Exception as e:
                logger.warning(f"Error creating embedding for ticket {t.get('id')}: {e}")
    
    logger.info(f"Indexed {len(TICKET_INDEX)} tickets with {len(TICKET_VECS)} embeddings")


def start_reindexer(interval_seconds: int = 24 * 60 * 60):
    """Start background reindexing thread (runs daily by default)"""
    def reindex_loop():
        logger.info("Starting knowledge reindexer (daily)")
        while True:
            try:
                logger.info("Reindexing knowledge base...")
                index_all_connectors()
                logger.info(f"Knowledge base reindexed. Next reindex in {interval_seconds}s")
            except Exception as e:
                logger.error(f"Error during reindex: {e}", exc_info=True)
            time.sleep(interval_seconds)
    
    t = Thread(target=reindex_loop, daemon=True)
    t.start()
    logger.info("Knowledge reindexer started")


def query_tickets(query: str, limit: int = 5, include_solutions: bool = True) -> List[Dict]:
    """
    Semantic search for tickets. Returns relevant tickets with solutions.
    Uses full ticket content (not just keywords) for matching.
    """
    if not TICKET_VECS:
        logger.warning("No tickets indexed. Running initial index...")
        index_all_connectors()
    
    if not TICKET_VECS:
        return []
    
    try:
        # Get query embedding
        qvec = get_embedding(query)
        
        # Score all tickets
        scored = []
        for t, vec in TICKET_VECS:
            score = cosine_similarity(qvec, vec)
            if score > 0:  # Only include positive matches
                scored.append((score, t))
        
        # Sort by score (highest first)
        scored.sort(key=lambda s: s[0], reverse=True)
        
        # Get top results
        results = []
        for score, ticket in scored[:limit]:
            result = ticket.copy()
            result["relevance_score"] = round(score, 3)
            
            # Include solution if available
            if include_solutions:
                ticket_id = ticket.get("id", "")
                if ticket_id in TICKET_SOLUTIONS:
                    result["solution"] = TICKET_SOLUTIONS[ticket_id]
                elif ticket.get("solution"):
                    result["solution"] = ticket.get("solution")
            
            results.append(result)
        
        return results
    except Exception as e:
        logger.error(f"Error querying tickets: {e}", exc_info=True)
        return []


def detect_ticket_intent(query: str) -> Dict:
    """
    Detect if user wants to create a ticket or connect to an agent.
    Supports all languages using multi-language detection.
    Returns dict with 'needs_ticket', 'needs_agent', 'should_route', and 'detected_language'.
    """
    from app.services.language_detection import detect_ticket_intent_multilang
    return detect_ticket_intent_multilang(query)


def query_crawled_knowledge(query: str, user_id: int, limit: int = 5) -> List[Dict]:
    """
    Query crawled knowledge content from database using semantic search
    
    Args:
        query: User query
        user_id: User ID to filter sources
        limit: Maximum number of results
        
    Returns:
        List of relevant content chunks
    """
    try:
        from app.db.session import SessionLocal
        from app.db.models.knowledge import KnowledgeSource, KnowledgeContent
        
        db = SessionLocal()
        try:
            # Get all active sources for the user
            sources = db.query(KnowledgeSource).filter(
                KnowledgeSource.user_id == user_id,
                KnowledgeSource.is_active == True
            ).all()
            
            if not sources:
                return []
            
            # Get query embedding
            query_embedding = get_embedding(query)
            
            # Get all content chunks from user's sources
            all_content = []
            for source in sources:
                all_content.extend(source.content_chunks)
            
            if not all_content:
                return []
            
            # Score content by similarity
            scored_content = []
            for content in all_content:
                if content.embedding:
                    try:
                        # Calculate similarity
                        similarity = cosine_similarity(query_embedding, content.embedding)
                        if similarity > 0:  # Only include positive matches
                            scored_content.append((similarity, content))
                    except Exception as e:
                        logger.warning(f"Error calculating similarity: {e}")
                        continue
            
            # Sort by score (highest first)
            scored_content.sort(key=lambda x: x[0], reverse=True)
            
            # Return top results
            results = []
            for score, content in scored_content[:limit]:
                results.append({
                    "id": f"KB-{content.id}",
                    "title": content.title or "Untitled",
                    "body": content.content,
                    "url": content.url,
                    "source_name": content.source.name,
                    "source_type": content.source.source_type.value,
                    "relevance_score": round(score, 3),
                    "metadata": content.content_metadata or {}
                })
            
            return results
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error querying crawled knowledge: {e}", exc_info=True)
        return []


async def query_with_solution(query: str, limit: int = 3, conversation_history: Optional[List[Dict]] = None, user_id: Optional[int] = None) -> Dict:
    """
    Query tickets and generate a comprehensive solution using LLM.
    Analyzes full ticket content and provides relevant solutions.
    Generates unique, contextual responses for each query.
    Detects if user wants to create ticket or connect to agent and routes accordingly.
    """
    # Check if user wants to create ticket or connect to agent
    intent = detect_ticket_intent(query)
    if intent["should_route"]:
        return {
            "type": "ROUTE_TO_CUSTOMER_SERVICE",
            "message": "I understand you'd like to create a ticket or connect with an agent. Let me transfer you to our Customer Service team who can help you with troubleshooting and ticket creation.",
            "intent": intent,
            "original_query": query,
            "should_route": True,
            "target_tool": "customer_service"
        }
    
    # Get relevant tickets
    tickets = query_tickets(query, limit=limit, include_solutions=True)
    
    # Get relevant crawled knowledge content if user_id is provided
    crawled_content = []
    if user_id:
        try:
            crawled_content = query_crawled_knowledge(query, user_id, limit=limit)
        except Exception as e:
            logger.warning(f"Error querying crawled knowledge: {e}")
    
    # Combine tickets and crawled content
    all_results = tickets + crawled_content
    
    # If no local results found, try web search
    if not all_results:
        try:
            logger.info(f"No local results found for '{query}'. Attempting web search...")
            web_service = WebSearchService()
            web_results = web_service.search(query)
            
            if web_results:
                # Format web results for the context
                formatted_web_results = []
                for res in web_results:
                    formatted_web_results.append({
                        "id": f"WEB-{hash(res.get('href', ''))}",
                        "title": res.get('title', 'Web Result'),
                        "body": res.get('body', ''),
                        "url": res.get('href', ''),
                        "source_name": "DuckDuckGo",
                        "source_type": "web_search",
                        "relevance_score": 0.8, # Assume reasonably relevant if returned by search engine
                        "metadata": {"query": query}
                    })
                
                all_results.extend(formatted_web_results)
                
                # Auto-learn from these results in the background (if user_id is present)
                if user_id:
                    # We use a thread to not block the response
                    Thread(target=web_service.learn_from_search, args=(query, web_results, user_id)).start()
                    logger.info(f"Triggered background learning for query: {query}")
        except Exception as e:
            logger.error(f"Error performing web search: {e}")

    if not all_results:
        # Generate contextual, helpful response even when no tickets found using LLM
        query_lower = query.lower()
        
        # Try to use LLM to generate a helpful response
        try:
            llm_prompt = f"""A user is asking: "{query}"

We don't have similar past tickets in our knowledge base, but I need to provide helpful guidance anyway.

Please provide:
1. A brief acknowledgment of their issue
2. General troubleshooting steps relevant to their query
3. A suggestion to provide more details if needed

Be conversational, helpful, and specific to their query. Don't just say "I couldn't find information" - actually help them.

Response:"""
            
            solution_text = ""
            async for token in explain(llm_prompt):
                solution_text += token
            
            if solution_text and len(solution_text.strip()) > 20:
                fallback_solution = solution_text.strip()
            else:
                # Fallback to contextual response if LLM fails
                if "phone" in query_lower or "mobile" in query_lower or "device" in query_lower:
                    fallback_solution = f"I understand you're having an issue with your phone. Let me help you troubleshoot:\n\n1. Try restarting your device\n2. Check for software updates\n3. Verify your network connection\n4. If the issue persists, please provide more details like: what exactly isn't working, when it started, and any error messages you see."
                elif "login" in query_lower or "password" in query_lower or "access" in query_lower:
                    fallback_solution = f"I can help with login issues. Here are some steps to try:\n\n1. Verify your username/email is correct\n2. Try resetting your password\n3. Clear your browser cache and cookies\n4. Check if your account is locked or suspended\n\nIf these don't work, please share more details about the specific error message you're seeing."
                elif "payment" in query_lower or "billing" in query_lower:
                    fallback_solution = f"I can help with payment or billing questions. Please try:\n\n1. Check your payment method is valid\n2. Review recent transactions in your account\n3. Verify billing information is up to date\n4. Contact your bank if there are authorization issues\n\nFor specific billing questions, please provide your account details or transaction ID."
                elif "lost" in query_lower or "missing" in query_lower:
                    fallback_solution = f"I understand you've lost something. Here's how I can help:\n\n1. If it's a device, try using 'Find My Device' features\n2. Check if you have backups of important data\n3. Report it to support immediately if it contains sensitive information\n4. Consider remote lock/wipe options if available\n\nPlease provide more details about what you lost and when, so I can give more specific guidance."
                else:
                    fallback_solution = f"I understand you need help with '{query}'. While I don't have similar past cases in our knowledge base, I can still assist you.\n\nPlease provide:\n- More details about the specific issue\n- When it started happening\n- Any error messages you've seen\n- What you've already tried\n\nThis will help me give you the best solution."
        except Exception as e:
            logger.error(f"Error generating LLM response for empty results: {e}")
            # Final fallback
            fallback_solution = f"I understand you need help with '{query}'. Please provide more details about your specific issue so I can assist you better."
        
        return {
            "results": [],
            "solution": fallback_solution,
            "confidence": 0.0,
            "tickets_found": 0
        }
    
    # Build rich context from tickets and crawled content (include more details)
    context = "Relevant information from knowledge base:\n\n"
    for i, item in enumerate(all_results, 1):
        item_type = "Knowledge Base" if item.get('id', '').startswith('KB-') else "Ticket"
        context += f"=== {item_type} {i} (Relevance: {item.get('relevance_score', 0):.2%}) ===\n"
        context += f"Title: {item.get('title', 'N/A')}\n"
        
        # Include more of the body for better context
        body_text = item.get('body', 'N/A')
        if len(body_text) > 500:
            context += f"Content: {body_text[:500]}...\n"
        else:
            context += f"Content: {body_text}\n"
        
        if item.get('solution'):
            context += f"Solution Applied: {item.get('solution')}\n"
        if item.get('url'):
            context += f"Source URL: {item.get('url')}\n"
        if item.get('source_name'):
            context += f"Source: {item.get('source_name')} ({item.get('source_type', 'unknown')})\n"
        if item.get('status'):
            context += f"Status: {item.get('status', 'unknown')}\n"
        context += "\n"
    
    # Build conversation context if available
    conversation_context = ""
    if conversation_history and len(conversation_history) > 0:
        recent_messages = conversation_history[-3:]  # Last 3 messages
        conversation_context = "\nPrevious conversation context:\n"
        for msg in recent_messages:
            role = msg.get("role", "user")
            text = msg.get("text", "")[:100]  # Limit length
            conversation_context += f"- {role}: {text}\n"
        conversation_context += "\n"
    
    # Generate unique, contextual solution using LLM with better prompt
    prompt = f"""You are a knowledgeable customer service assistant. Analyze the following past tickets and provide a unique, helpful solution for this specific query.

User's Current Query: "{query}"
{conversation_context}
{context}

Instructions:
1. Analyze the query and match it to relevant past tickets/knowledge.
2. Provide a clear, step-by-step solution based on what worked in similar cases.
3. If multiple items are relevant, synthesize the best approach.
4. Be specific and actionable - don't just repeat generic advice.
5. CITE YOUR SOURCES: When using information from a specific context item, append its index number like [1], [2] at the end of the sentence.
6. If the query is different from past tickets, acknowledge this and provide general guidance.

At the very end of your response, strictly following the separator "---FOLLOW_UP---", provide 3 short, relevant follow-up questions the user might ask next.
Format:
[Solution text with citations...]

---FOLLOW_UP---
- [Question 1]
- [Question 2]
- [Question 3]
"""
    
    solution_text = ""
    follow_up_questions = []
    
    try:
        full_response = ""
        async for token in explain(prompt):
            full_response += token
            
        # Parse solution and follow-ups
        if "---FOLLOW_UP---" in full_response:
            parts = full_response.split("---FOLLOW_UP---")
            solution_text = parts[0].strip()
            # Parse questions
            q_text = parts[1].strip()
            for line in q_text.split('\n'):
                line = line.strip()
                if line.startswith('- ') or line.startswith('• '):
                    follow_up_questions.append(line[2:].strip())
                elif line and line[0].isdigit() and '. ' in line:
                     follow_up_questions.append(line.split('. ', 1)[1].strip())
        else:
            solution_text = full_response.strip()
            
    except Exception as e:
        logger.error(f"Error generating solution: {e}")
        solution_text = "I found some relevant information but couldn't generate a specific solution. Please check the sources below."

    # Calculate average confidence
    avg_confidence = 0.0
    if all_results:
        scores = [r.get('relevance_score', 0) for r in all_results]
        avg_confidence = sum(scores) / len(scores)

    return {
        "results": all_results,
        "solution": solution_text,
        "follow_up_questions": follow_up_questions,
        "confidence": round(avg_confidence, 2),
        "tickets_found": len(all_results)
    }


def add_solution(ticket_id: str, solution: str):
    """Add a solution to the knowledge base for learning"""
    TICKET_SOLUTIONS[ticket_id] = solution
    logger.info(f"Added solution for ticket {ticket_id}")
