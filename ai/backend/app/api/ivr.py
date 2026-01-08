"""
IVR (Interactive Voice Response) API Endpoints
Handles phone calls, voice interactions, and IVR flows
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Form, Header
from fastapi.responses import Response, PlainTextResponse
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime
import logging
import json

from app.db.session import get_db
from app.db.models.agent import Agent, AgentConversation, AgentMessage, AgentType
from app.services.telephony_service import telephony_service
from app.services.agent_executor import AgentExecutor
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/call-handler")
async def handle_incoming_call(
    request: Request,
    CallSid: str = Form(None),
    From: str = Form(None),
    To: str = Form(None),
    CallStatus: str = Form(None),
    Digits: str = Form(None),
    SpeechResult: str = Form(None),
    agent_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Handle incoming Twilio phone calls
    This endpoint receives webhooks from Twilio for call events
    """
    try:
        # Get form data from Twilio webhook
        form_data = await request.form()
        call_sid = form_data.get("CallSid") or CallSid
        from_number = form_data.get("From") or From
        to_number = form_data.get("To") or To
        call_status = form_data.get("CallStatus") or CallStatus
        digits = form_data.get("Digits") or Digits
        speech_result = form_data.get("SpeechResult") or SpeechResult
        
        # Get agent_id from query params or form
        if not agent_id:
            agent_id_param = form_data.get("agent_id") or request.query_params.get("agent_id")
            if agent_id_param:
                try:
                    agent_id = int(agent_id_param)
                except (ValueError, TypeError):
                    agent_id = None
        
        logger.info(f"Incoming call: CallSid={call_sid}, From={from_number}, To={to_number}, Status={call_status}, Digits={digits}, AgentID={agent_id}")
        
        # If no agent_id, try to find default IVR agent
        if not agent_id:
            agent = db.query(Agent).filter(
                Agent.agent_type == AgentType.IVR,
                Agent.is_active == True
            ).first()
            if agent:
                agent_id = agent.id
            else:
                # Return default greeting
                twiml = telephony_service.generate_ivr_twiml(
                    "Thank you for calling. No IVR agent is currently configured. Please contact support.",
                    gather_input=False
                )
                return Response(content=twiml, media_type="application/xml")
        else:
            agent = db.query(Agent).filter(Agent.id == agent_id).first()
            if not agent:
                twiml = telephony_service.generate_ivr_twiml(
                    "Invalid agent configuration. Please contact support.",
                    gather_input=False
                )
                return Response(content=twiml, media_type="application/xml")
        
        # Get or create conversation
        session_id = call_sid  # Use call SID as session ID
        conversation = db.query(AgentConversation).filter(
            AgentConversation.agent_id == agent_id,
            AgentConversation.session_id == session_id,
            AgentConversation.is_active == True
        ).first()
        
        if not conversation:
            conversation = AgentConversation(
                agent_id=agent_id,
                session_id=session_id,
                channel="ivr",
                context={
                    "call_sid": call_sid,
                    "from_number": from_number,
                    "to_number": to_number,
                    "call_status": call_status
                }
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
        
        # Process input (DTMF digits or speech)
        user_input = None
        if digits:
            user_input = digits
        elif speech_result:
            user_input = speech_result
        
        # If this is the initial call (no input yet), play welcome message
        if not user_input and call_status == "ringing":
            welcome_message = agent.welcome_message or "Welcome. How can I help you today?"
            
            # Generate TwiML with input gathering
            api_base = settings.API_BASE_URL
            action_url = f"{api_base}/api/ivr/call-handler?agent_id={agent_id}"
            
            twiml = telephony_service.generate_ivr_twiml(
                welcome_message,
                gather_input=True,
                num_digits=1,
                action_url=action_url,
                timeout=10
            )
            return Response(content=twiml, media_type="application/xml")
        
        # Process user input through agent flow
        if user_input:
            # Save user input
            user_message = AgentMessage(
                conversation_id=conversation.id,
                role="user",
                content=user_input,
                message_metadata={
                    "input_type": "dtmf" if digits else "speech",
                    "call_sid": call_sid
                }
            )
            db.add(user_message)
            
            # Execute agent flow
            executor = AgentExecutor(db)
            result = await executor.execute(agent, conversation, user_input)
            
            # Get response
            response_text = result.get("response", agent.fallback_message or "I didn't understand that. Please try again.")
            
            # Save assistant response
            assistant_message = AgentMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=response_text
            )
            db.add(assistant_message)
            
            # Update conversation
            conversation.current_node_id = result.get("node_id")
            conversation.context = result.get("context", conversation.context)
            conversation.updated_at = datetime.utcnow()
            db.commit()
            
            # Generate TwiML response
            api_base = settings.API_BASE_URL
            action_url = f"{api_base}/api/ivr/call-handler?agent_id={agent_id}"
            
            # Check if flow is complete (END node reached)
            if result.get("node_id") is None or conversation.current_node_id is None:
                # End of flow - offer to continue or hang up
                twiml = telephony_service.generate_ivr_twiml(
                    f"{response_text} Press 1 to continue, or press 0 to end the call.",
                    gather_input=True,
                    num_digits=1,
                    action_url=action_url
                )
            else:
                # Continue flow - ask for next input
                twiml = telephony_service.generate_ivr_twiml(
                    response_text,
                    gather_input=True,
                    num_digits=1,
                    action_url=action_url,
                    timeout=10
                )
            
            return Response(content=twiml, media_type="application/xml")
        
        # Default response
        twiml = telephony_service.generate_ivr_twiml(
            "Please provide your input.",
            gather_input=True,
            num_digits=1,
            action_url=f"{os.getenv('API_BASE_URL', 'http://localhost:8001')}/api/ivr/call-handler?agent_id={agent_id}"
        )
        return Response(content=twiml, media_type="application/xml")
        
    except Exception as e:
        logger.error(f"Error handling IVR call: {str(e)}", exc_info=True)
        twiml = telephony_service.generate_ivr_twiml(
            "We encountered an error. Please try again later.",
            gather_input=False
        )
        return Response(content=twiml, media_type="application/xml")


@router.post("/make-call")
async def make_call(
    to_number: str,
    agent_id: int,
    from_number: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db)
):
    """
    Make an outbound phone call to a user
    
    Args:
        to_number: Phone number to call (E.164 format: +1234567890)
        agent_id: Agent ID to use for the call
        from_number: Phone number to call from (optional)
        context: Additional context data
    """
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if not agent.is_active:
        raise HTTPException(status_code=400, detail="Agent is not active")
    
    # Build webhook URL
    api_base = settings.API_BASE_URL
    webhook_url = f"{api_base}/api/ivr/call-handler?agent_id={agent_id}"
    
    # Make the call
    result = await telephony_service.make_call(
        to_number=to_number,
        from_number=from_number,
        webhook_url=webhook_url,
        agent_id=agent_id,
        context=context
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to make call"))
    
    return result


@router.post("/transfer-call")
async def transfer_call(
    call_sid: str,
    to_number: str
):
    """
    Transfer an active call to another number (e.g., live agent)
    
    Args:
        call_sid: Twilio Call SID
        to_number: Number to transfer to
    """
    result = telephony_service.transfer_call(call_sid, to_number)
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to transfer call"))
    
    return result


@router.post("/hangup-call")
async def hangup_call(call_sid: str):
    """
    Hang up an active call
    
    Args:
        call_sid: Twilio Call SID
    """
    result = telephony_service.hangup_call(call_sid)
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to hang up call"))
    
    return result


@router.get("/call-status/{call_sid}")
async def get_call_status(call_sid: str):
    """
    Get status of a call
    
    Args:
        call_sid: Twilio Call SID
    """
    result = telephony_service.get_call_status(call_sid)
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to get call status"))
    
    return result


@router.post("/redirect-to-call")
async def redirect_chat_to_call(
    agent_id: int,
    phone_number: str,
    session_id: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db)
):
    """
    Redirect a chat conversation to a phone call
    This allows users to seamlessly transition from chat to voice
    
    Args:
        agent_id: IVR agent ID to use
        phone_number: User's phone number to call
        session_id: Optional chat session ID to continue context
        context: Additional context from chat conversation
    """
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.agent_type == AgentType.IVR,
        Agent.is_active == True
    ).first()
    
    if not agent:
        raise HTTPException(status_code=404, detail="IVR agent not found or not active")
    
    # Build webhook URL with context
    api_base = settings.API_BASE_URL
    webhook_url = f"{api_base}/api/ivr/call-handler?agent_id={agent_id}"
    
    if session_id:
        webhook_url += f"&session_id={session_id}"
    
    if context:
        import urllib.parse
        webhook_url += f"&context={urllib.parse.quote(json.dumps(context))}"
    
    # Make the call
    result = await telephony_service.make_call(
        to_number=phone_number,
        webhook_url=webhook_url,
        agent_id=agent_id,
        context=context
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to initiate call"))
    
    return {
        "success": True,
        "call_sid": result.get("call_sid"),
        "message": f"Calling {phone_number}...",
        "agent_id": agent_id,
        "agent_name": agent.name
    }

