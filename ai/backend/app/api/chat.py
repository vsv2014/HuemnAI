# app/api/chat.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
from app.services.llm_service import explain
from app.services.ticket_service import (
    create_ticket_with_info,
    create_ticket_with_template,
    collect_troubleshooting_info,
    perform_basic_troubleshooting,
    get_or_create_ticket_for_user,
    update_ticket_description,
    detect_issue_type,
    determine_severity,
    get_next_question,
    get_ticket_template
)
from app.services.ticket_analyzer import (
    find_similar_tickets,
    generate_response_from_history,
    check_user_impact,
    adjust_severity_based_on_impact
)
from app.services.agent_router import select_best_agent
from app.services.emotion_service import analyze_tone, determine_priority_from_tone
from app.services.context_analyzer import (
    analyze_user_intent,
    should_create_ticket,
    generate_contextual_response
)
from app.db.session import SessionLocal
from app.db.models.ticket import Ticket
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatPayload(BaseModel):
    user_id: str
    message: str
    connector_type: Optional[str] = None  # jira, zendesk, etc.
    conversation_history: Optional[List[Dict]] = None


@router.get("/stream")
async def chat_stream(message: str):
    """Stream chat responses using Server-Sent Events (SSE)"""
    async def generator():
        try:
            # Use the explain function from llm_service to get streaming response
            async for token in explain(message):
                yield f"data: {token}\n\n"
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error in chat stream: {error_msg}", exc_info=True)
            
            # Check for rate limit errors
            if "rate" in error_msg.lower() or "limit" in error_msg.lower() or "token" in error_msg.lower():
                yield f"data: [ERROR] Rate limit exceeded. Please wait a moment before trying again.\n\n"
            else:
                yield f"data: [ERROR] {error_msg}\n\n"
    
    return StreamingResponse(generator(), media_type="text/event-stream")


@router.post("/handle")
async def handle_chat(payload: ChatPayload):
    """
    Handle customer service chat with intelligent tone analysis and contextual responses.
    Adapts behavior based on user's tone, urgency, and intent.
    Supports both independent and integrated modes.
    """
    user_id = payload.user_id
    message = payload.message
    connector_type = payload.connector_type
    conversation_history = payload.conversation_history or []
    
    # Check tool operation mode
    from app.core.tool_registry import get_tool
    tool_entry = get_tool("customer_service")
    operation_mode = "integrated"  # default
    if tool_entry:
        operation_mode = tool_entry.operation_mode or "integrated"
    
    # In independent mode, don't use external connectors
    if operation_mode == "independent":
        connector_type = None
    
    if not user_id or not message:
        return {
            "type": "INVALID_REQUEST",
            "message": "user_id and message are required"
        }
    
    # Analyze user's tone and emotional state
    tone_analysis = analyze_tone(message, conversation_history)
    
    # Analyze user's intent
    intent = analyze_user_intent(message, conversation_history)
    
    # Generate contextual, polite response
    contextual_response = generate_contextual_response(message, conversation_history, tone_analysis, intent)
    
    # Check if there's already an active ticket for this user
    db = SessionLocal()
    try:
        existing_ticket = db.query(Ticket).filter(
            Ticket.assigned_to == user_id,
            Ticket.status == "open"
        ).order_by(Ticket.created_at.desc()).first()
        
        # Handle greetings - no ticket needed
        if intent["is_greeting"] and not intent["needs_help"]:
            return {
                "type": "GREETING",
                "message": contextual_response,
                "ticket_created": False
            }
        
        # Handle farewells - acknowledge and close if needed
        if intent["is_farewell"]:
            if existing_ticket:
                return {
                    "type": "FAREWELL",
                    "message": contextual_response,
                    "ticket_id": existing_ticket.id,
                    "ticket_created": False
                }
            else:
                return {
                    "type": "FAREWELL",
                    "message": contextual_response,
                    "ticket_created": False
                }
        
        # Collect troubleshooting information
        customer_info = collect_troubleshooting_info(conversation_history + [{"role": "user", "text": message}])
        
        # Perform basic troubleshooting
        troubleshooting = perform_basic_troubleshooting(message)
        
        # Determine if ticket should be created based on intent and tone
        should_create = should_create_ticket(message, conversation_history, intent)
        
        # Determine priority from tone (urgent, high, medium, low)
        priority = determine_priority_from_tone(tone_analysis)
        
        # Step 1: Check for similar previous tickets
        similar_tickets = []
        history_response = None
        knowledge_base_info = None
        if should_create:
            similar_tickets = find_similar_tickets(message, limit=5, min_similarity=0.7)
            if similar_tickets:
                history_response = generate_response_from_history(
                    message,
                    similar_tickets,
                    conversation_history
                )
            
            # Query knowledge base for relevant information
            try:
                from app.services.knowledge_service import query_crawled_knowledge
                # Try to get user_id from payload or session
                user_account = None
                if hasattr(payload, 'user_id') and payload.user_id:
                    from app.db.models.subscription import UserAccount
                    user_account = db.query(UserAccount).filter(UserAccount.email == payload.user_id).first()
                
                if user_account:
                    knowledge_content = query_crawled_knowledge(message, user_account.id, limit=3)
                    if knowledge_content:
                        # Build knowledge base context
                        kb_context = "Relevant information from knowledge base:\n"
                        for kb_item in knowledge_content:
                            kb_context += f"- {kb_item.get('title', 'Untitled')}: {kb_item.get('body', '')[:200]}...\n"
                            if kb_item.get('url'):
                                kb_context += f"  Source: {kb_item.get('url')}\n"
                        
                        knowledge_base_info = {
                            "content": knowledge_content,
                            "context": kb_context,
                            "count": len(knowledge_content)
                        }
            except Exception as e:
                logger.warning(f"Error querying knowledge base in customer service: {e}")
        
        # Check if we're in a question flow (ticket creation in progress)
        # Store question flow state in conversation history or session
        question_flow_state = None
        if conversation_history:
            # Check if last assistant message was a question
            last_assistant_msg = None
            for msg in reversed(conversation_history):
                if msg.get("role") == "assistant" and msg.get("data", {}).get("type") == "QUESTION_FLOW":
                    question_flow_state = msg.get("data", {}).get("flow_state")
                    break
        
        if existing_ticket:
            # Update existing ticket with new information
            try:
                current_desc = existing_ticket.description or ""
                new_desc = f"{current_desc}\n\n[Update] {message}" if current_desc else message
                existing_ticket.description = new_desc
                
                # Update priority if user's tone indicates higher urgency
                if priority == "urgent" and existing_ticket.priority != "urgent":
                    existing_ticket.priority = "urgent"
                elif priority == "high" and existing_ticket.priority not in ["urgent", "high"]:
                    existing_ticket.priority = "high"
                
                # Update customer info
                if customer_info:
                    existing_customer_info = existing_ticket.customer_info or {}
                    existing_customer_info.update(customer_info)
                    existing_ticket.customer_info = existing_customer_info
                
                db.commit()
                db.refresh(existing_ticket)
                
                response = {
                    "type": "TICKET_UPDATED",
                    "ticket_id": existing_ticket.id,
                    "assigned_to": existing_ticket.assigned_to,
                    "message": contextual_response,
                    "troubleshooting": {
                        "steps": troubleshooting.get("steps", []),
                        "potential_solution": troubleshooting.get("potential_solution")
                    },
                    "tone": tone_analysis["tone"],
                    "is_new_ticket": False
                }
                
                # Add knowledge base information if available
                if knowledge_base_info:
                    response["knowledge_base"] = {
                        "sources": knowledge_base_info["content"],
                        "count": knowledge_base_info["count"]
                    }
                
                return response
            except Exception as e:
                logger.error(f"Error updating ticket: {e}", exc_info=True)
                db.rollback()
                should_create = True
        
        if should_create and not existing_ticket:
            # Use template-based ticket creation with question flow
            try:
                # Check user impact for high severity tickets
                impact_assessment = check_user_impact(message, conversation_history)
                
                # Adjust severity if needed
                detected_severity = determine_severity(message, conversation_history)
                if detected_severity == "high":
                    adjusted_severity, severity_reason = adjust_severity_based_on_impact(
                        detected_severity,
                        impact_assessment
                    )
                    if adjusted_severity != detected_severity:
                        # Update priority based on adjusted severity
                        severity_priority_map = {
                            "critical": "urgent",
                            "high": "high",
                            "medium": "medium",
                            "low": "low"
                        }
                        priority = severity_priority_map.get(adjusted_severity, priority)
                        
                        # Add severity adjustment message
                        if severity_reason:
                            contextual_response = f"{contextual_response}\n\n{severity_reason}"
                
                # If we're continuing a question flow, use the existing state
                if question_flow_state:
                    # User is answering a question - collect info and check if we need more
                    collected_info = question_flow_state.get("collected_info", {})
                    issue_type = question_flow_state.get("issue_type", "general")
                    current_question_index = question_flow_state.get("_question_index", 0)
                    
                    # Update collected info with new answer
                    if customer_info:
                        collected_info.update(customer_info)
                    
                    # Move to next question
                    next_question_index = current_question_index + 1
                    template = get_ticket_template(issue_type)
                    questions = template.get("questions", [])
                    
                    if next_question_index < len(questions):
                        # Still need more information
                        next_question = questions[next_question_index]
                        return {
                            "type": "QUESTION_FLOW",
                            "message": contextual_response,
                            "next_question": next_question,
                            "issue_type": issue_type,
                            "severity": question_flow_state.get("severity", "medium"),
                            "priority": question_flow_state.get("priority", "medium"),
                            "collected_info": collected_info,
                            "flow_state": {
                                **question_flow_state,
                                "collected_info": collected_info,
                                "_question_index": next_question_index
                            }
                        }
                    else:
                        # Have enough info, create the ticket
                        template_result = create_ticket_with_template(
                            initial_message=message,
                            conversation_history=conversation_history,
                            connector_type=connector_type,
                            collected_info=collected_info,
                            question_index=next_question_index,
                            operation_mode=operation_mode
                        )
                        
                        if template_result.get("ticket_created"):
                            ticket = template_result["ticket"]
                            # Forward to ticket assigner (ticket is already assigned in create_ticket_with_info)
                            # The ticket assigner will handle reassignment if needed
                            
                            return {
                                "type": "TICKET_CREATED",
                                "ticket_id": ticket.id,
                                "assigned_to": ticket.assigned_to,
                                "message": f"{contextual_response} I've created your ticket and it has been forwarded to our team for resolution.",
                                "troubleshooting": {
                                    "steps": troubleshooting.get("steps", []),
                                    "potential_solution": troubleshooting.get("potential_solution")
                                },
                                "customer_info": collected_info,
                                "tone": tone_analysis["tone"],
                                "priority": template_result["priority"],
                                "severity": template_result["severity"],
                                "issue_type": template_result["issue_type"],
                                "is_new_ticket": True
                            }
                
                # If we have similar tickets and high confidence, use historical response
                if history_response and history_response.get("is_similar") and history_response.get("confidence", 0) >= 0.9:
                    # Very similar ticket - provide solution from history
                    similar_ticket_id = history_response.get("similar_ticket_id")
                    historical_response_text = history_response.get("response", "")
                    
                    # Still create ticket but with historical context
                    template_result = create_ticket_with_template(
                        initial_message=message,
                        conversation_history=conversation_history,
                        connector_type=connector_type,
                        collected_info={
                            **(customer_info or {}),
                            "similar_ticket_id": similar_ticket_id,
                            "historical_response_used": True
                        },
                        operation_mode=operation_mode
                    )
                    
                    if template_result.get("ticket_created"):
                        ticket = template_result["ticket"]
                        response = {
                            "type": "TICKET_CREATED",
                            "ticket_id": ticket.id,
                            "assigned_to": ticket.assigned_to,
                            "message": f"{historical_response_text}\n\nI've created your ticket (#{ticket.id}) and it will be forwarded to our team.",
                            "troubleshooting": {
                                "steps": troubleshooting.get("steps", []),
                                "potential_solution": troubleshooting.get("potential_solution")
                            },
                            "customer_info": customer_info,
                            "tone": tone_analysis["tone"],
                            "priority": template_result["priority"],
                            "severity": template_result["severity"],
                            "issue_type": template_result["issue_type"],
                            "similar_ticket_id": similar_ticket_id,
                            "is_new_ticket": True
                        }
                        
                        # Add knowledge base information if available
                        if knowledge_base_info:
                            response["knowledge_base"] = {
                                "sources": knowledge_base_info["content"],
                                "count": knowledge_base_info["count"]
                            }
                        
                        return response
                
                # Start new ticket creation with template
                template_result = create_ticket_with_template(
                    initial_message=message,
                    conversation_history=conversation_history,
                    connector_type=connector_type,
                    collected_info={
                        **(customer_info or {}),
                        "similar_tickets": [t["ticket_id"] for t in similar_tickets[:3]] if similar_tickets else [],
                        "history_response": history_response
                    },
                    operation_mode=operation_mode
                )
                
                if template_result.get("ticket_created"):
                    # Ticket created immediately
                    ticket = template_result["ticket"]
                    return {
                        "type": "TICKET_CREATED",
                        "ticket_id": ticket.id,
                        "assigned_to": ticket.assigned_to,
                        "message": f"{contextual_response} I've created your ticket and it will be forwarded to our team for resolution.",
                        "troubleshooting": {
                            "steps": troubleshooting.get("steps", []),
                            "potential_solution": troubleshooting.get("potential_solution")
                        },
                        "customer_info": customer_info,
                        "tone": tone_analysis["tone"],
                        "priority": template_result["priority"],
                        "severity": template_result["severity"],
                        "issue_type": template_result["issue_type"],
                        "is_new_ticket": True
                    }
                else:
                    # Need to ask questions first
                    # Use questions from history if available
                    suggested_questions = []
                    if history_response and history_response.get("suggested_questions"):
                        suggested_questions = history_response["suggested_questions"]
                    
                    # Use template question or historical question
                    next_question = template_result["next_question"]
                    if suggested_questions and not next_question:
                        next_question = suggested_questions[0] if suggested_questions else template_result["next_question"]
                    
                    message_text = f"{contextual_response} To help you better, I need to gather some information."
                    if history_response and history_response.get("is_similar"):
                        message_text = f"{history_response.get('response', contextual_response)}"
                    
                    return {
                        "type": "QUESTION_FLOW",
                        "message": message_text,
                        "next_question": next_question,
                        "issue_type": template_result["issue_type"],
                        "severity": template_result["severity"],
                        "priority": template_result["priority"],
                        "collected_info": template_result.get("collected_info", {}),
                        "similar_tickets_found": len(similar_tickets) if similar_tickets else 0,
                        "flow_state": {
                            "issue_type": template_result["issue_type"],
                            "severity": template_result["severity"],
                            "priority": template_result["priority"],
                            "collected_info": template_result.get("collected_info", {}),
                            "template": template_result.get("template", {}),
                            "_question_index": 0,
                            "suggested_questions": suggested_questions
                        }
                    }
                    
            except Exception as e:
                logger.error(f"Error creating ticket: {str(e)}", exc_info=True)
                return {
                    "type": "ERROR",
                    "message": f"I apologize for the technical issue. {contextual_response}",
                    "error": str(e)
                }
        else:
            # Provide helpful response without creating ticket
            return {
                "type": "TROUBLESHOOTING",
                "message": contextual_response + " " + (troubleshooting.get("potential_solution", "") or "Let me help you with that."),
                "steps": troubleshooting.get("steps", []),
                "ticket_created": False,
                "tone": tone_analysis["tone"]
            }
    finally:
        db.close()


@router.post("/configure-connector")
async def configure_connector(payload: Dict):
    """
    Configure a ticketing tool connector (Jira, Zendesk, Salesforce, etc.)
    Stores credentials in environment or secure storage.
    Also handles tool operation mode (independent vs integrated).
    """
    connector_type = payload.get("connector_type")
    credentials = payload.get("credentials", {})
    operation_mode = payload.get("operation_mode", "integrated")
    
    # If operation_mode is set but no connector_type, just set the mode
    if not connector_type and operation_mode:
        tool_name = payload.get("tool_name", "customer_service")
        from app.core.tool_registry import save_config
        save_config(tool_name, operation_mode=operation_mode)
        return {
            "success": True,
            "operation_mode": operation_mode,
            "message": f"Tool {tool_name} set to {operation_mode} mode"
        }
    
    if not connector_type:
        raise HTTPException(status_code=400, detail="connector_type is required")
    
    try:
        # Store credentials as environment variables (in production, use secure storage)
        import os
        from app.core.connector_manager import get_connector
        
        # Map credentials to environment variables based on connector type
        if connector_type == "jira":
            if credentials.get("url"):
                os.environ["JIRA_URL"] = credentials["url"]
            if credentials.get("email"):
                os.environ["JIRA_EMAIL"] = credentials["email"]
            if credentials.get("apiToken"):
                os.environ["JIRA_API_TOKEN"] = credentials["apiToken"]
        
        elif connector_type == "zendesk":
            if credentials.get("url"):  # subdomain
                os.environ["ZENDESK_SUBDOMAIN"] = credentials["url"]
            if credentials.get("email"):
                os.environ["ZENDESK_EMAIL"] = credentials["email"]
            if credentials.get("apiToken"):
                os.environ["ZENDESK_API_TOKEN"] = credentials["apiToken"]
        
        elif connector_type == "salesforce":
            if credentials.get("username"):
                os.environ["SALESFORCE_USERNAME"] = credentials["username"]
            if credentials.get("password"):
                os.environ["SALESFORCE_PASSWORD"] = credentials["password"]
            if credentials.get("apiToken"):  # security token
                os.environ["SALESFORCE_SECURITY_TOKEN"] = credentials["apiToken"]
        
        # Validate connector if available
        connector = get_connector(connector_type)
        if connector:
            validate = getattr(connector, "validate", None)
            if callable(validate):
                is_valid = validate()
                if not is_valid:
                    return {
                        "success": False,
                        "connector_type": connector_type,
                        "message": f"Connector {connector_type} credentials are invalid. Please check your credentials."
                    }
        
        logger.info(f"Connector {connector_type} configured successfully")
        return {
            "success": True,
            "connector_type": connector_type,
            "message": f"Connector {connector_type} configured successfully. You can now use it for ticket creation and management."
        }
    except Exception as e:
        logger.error(f"Error configuring connector {connector_type}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to configure connector: {str(e)}")
