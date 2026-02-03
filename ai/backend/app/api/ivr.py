"""
IVR (Interactive Voice Response) API Endpoints
Handles phone calls, voice interactions, and IVR flows
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Form, Header, BackgroundTasks
from fastapi.responses import Response, PlainTextResponse
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime
import logging
import json
import urllib.parse

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
    background_tasks: BackgroundTasks,
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
        
        # Get context from query params if available (for chat->IVR continuity)
        initial_context = {}
        context_param = request.query_params.get("context")
        if context_param:
            try:
                # It might be double encoded or just JSON
                decoded = urllib.parse.unquote(context_param)
                initial_context = json.loads(decoded)
            except Exception as e:
                logger.warning(f"Failed to parse context param: {e}")

        # Get session_id from query params if available (for chat->IVR continuity)
        query_session_id = request.query_params.get("session_id")
        
        # If not in query params, check in context
        if not query_session_id and initial_context and "session_id" in initial_context:
            query_session_id = initial_context["session_id"]
            
        session_id = query_session_id if query_session_id else call_sid
        
        conversation = db.query(AgentConversation).filter(
            AgentConversation.agent_id == agent_id,
            AgentConversation.session_id == session_id,
            AgentConversation.is_active == True
        ).first()
        
        if not conversation:
            context_data = {
                "call_sid": call_sid,
                "from_number": from_number,
                "to_number": to_number,
                "call_status": call_status
            }
            # Merge initial context if available
            if initial_context:
                context_data.update(initial_context)
                context_data["source_channel"] = "chat_handoff"
            
            conversation = AgentConversation(
                agent_id=agent_id,
                session_id=session_id,
                channel="ivr",
                context=context_data
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
            
            # Check for configured voice
            voice_id = None
            if agent.settings:
                # Try to get voice_id from settings
                if isinstance(agent.settings, dict):
                     voice_id = agent.settings.get("voice_id")
                elif isinstance(agent.settings, str):
                     try:
                         settings_dict = json.loads(agent.settings)
                         voice_id = settings_dict.get("voice_id")
                     except:
                         pass

            # Generate TwiML with input gathering
            api_base = settings.API_BASE_URL
            action_url = f"{api_base}/api/ivr/call-handler?agent_id={agent_id}"
            if query_session_id:
                action_url += f"&session_id={query_session_id}"
            
            twiml = telephony_service.generate_ivr_twiml(
                welcome_message,
                gather_input=True,
                num_digits=1,
                action_url=action_url,
                timeout=10,
                voice_id=voice_id
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
            db.commit()
            
            # Execute Agent Logic
            executor = AgentExecutor(agent_id, session_id, db)
            response_text = await executor.execute(user_input)
            
            # Save assistant response
            assistant_message = AgentMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=response_text,
                message_metadata={"generated_by": "agent_executor"}
            )
            db.add(assistant_message)
            db.commit()
            
            # Check for configured voice
            voice_id = None
            if agent.settings:
                if isinstance(agent.settings, dict):
                     voice_id = agent.settings.get("voice_id")
                elif isinstance(agent.settings, str):
                     try:
                         settings_dict = json.loads(agent.settings)
                         voice_id = settings_dict.get("voice_id")
                     except:
                         pass

            # Generate TwiML response
            api_base = settings.API_BASE_URL
            action_url = f"{api_base}/api/ivr/call-handler?agent_id={agent_id}"
            if query_session_id:
                action_url += f"&session_id={query_session_id}"

            twiml = telephony_service.generate_ivr_twiml(
                response_text,
                gather_input=True,
                num_digits=1,
                action_url=action_url,
                timeout=10,
                voice_id=voice_id
            )
            return Response(content=twiml, media_type="application/xml")
            
        return Response(content="<Response></Response>", media_type="application/xml")

    except Exception as e:
        logger.error(f"Error handling call: {str(e)}")
        twiml = telephony_service.generate_ivr_twiml(
            "An error occurred. Please try again later.",
            gather_input=False
        )
        return Response(content=twiml, media_type="application/xml")

@router.post("/redirect-to-call")
async def redirect_chat_to_call(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Initiate a call to the user (Outbound) or provide instructions for Inbound
    """
    try:
        data = await request.json()
        phone_number = data.get("phone_number")
        agent_id = data.get("agent_id")
        session_id = data.get("session_id")
        context = data.get("context", {})
        
        if not phone_number or not agent_id:
            raise HTTPException(status_code=400, detail="Missing phone_number or agent_id")
            
        # Check if telephony service is available
        if not telephony_service.is_available():
             return {"success": False, "error": "Telephony service not configured"}

        # Prepare context for the call
        call_context = {
            "session_id": session_id,
            "original_context": context
        }

        # Initiate outbound call
        # The webhook_url defaults to /api/ivr/call-handler in make_call, which is what we want
        result = await telephony_service.make_call(
            to_number=phone_number,
            agent_id=agent_id,
            context=call_context
        )
        
        if result.get("success"):
            logger.info(f"Initiated call to {phone_number} for agent {agent_id} session {session_id}. Call SID: {result.get('call_sid')}")
        else:
            logger.error(f"Failed to initiate call: {result.get('error')}")
            
        return result
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error redirecting to call: {str(e)}")
        return {"success": False, "error": str(e)}

@router.post("/status-callback")
async def handle_status_callback(
    request: Request,
    CallSid: str = Form(None),
    CallStatus: str = Form(None),
    db: Session = Depends(get_db)
):
    """Handle Twilio call status updates"""
    try:
        form_data = await request.form()
        call_sid = form_data.get("CallSid") or CallSid
        call_status = form_data.get("CallStatus") or CallStatus
        
        logger.info(f"Call Status Update: CallSid={call_sid}, Status={call_status}")
        
        return Response(status_code=200)
    except Exception as e:
        logger.error(f"Error handling status callback: {str(e)}")
        return Response(status_code=500)

@router.get("/call-status/{call_sid}")
async def get_call_status(call_sid: str, db: Session = Depends(get_db)):
    """Get the status of a specific call"""
    # Check if telephony service is available
    if not telephony_service.is_available():
         return {"success": False, "error": "Telephony service not configured"}
            
    return telephony_service.get_call_status(call_sid)
