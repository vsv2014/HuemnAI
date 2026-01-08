"""
Telephony Service for IVR and Voice Call Handling
Supports Twilio integration for phone calls, SMS, and voice interactions
"""
import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)

try:
    from twilio.rest import Client as TwilioClient
    from twilio.twiml.voice_response import VoiceResponse, Gather
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    logger.warning("Twilio SDK not installed. Install with: pip install twilio")


class TelephonyService:
    """Service for handling telephony operations (calls, SMS, IVR)"""
    
    def __init__(self):
        from app.core.config import settings
        self.twilio_account_sid = settings.TWILIO_ACCOUNT_SID
        self.twilio_auth_token = settings.TWILIO_AUTH_TOKEN
        self.twilio_phone_number = settings.TWILIO_PHONE_NUMBER
        
        if TWILIO_AVAILABLE and self.twilio_account_sid and self.twilio_auth_token:
            self.twilio_client = TwilioClient(self.twilio_account_sid, self.twilio_auth_token)
            self.twilio_enabled = True
        else:
            self.twilio_client = None
            self.twilio_enabled = False
            logger.warning("Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.")
    
    def is_available(self) -> bool:
        """Check if telephony service is available"""
        return self.twilio_enabled
    
    async def make_call(
        self,
        to_number: str,
        from_number: Optional[str] = None,
        webhook_url: Optional[str] = None,
        agent_id: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make an outbound phone call
        
        Args:
            to_number: Phone number to call (E.164 format)
            from_number: Phone number to call from (defaults to TWILIO_PHONE_NUMBER)
            webhook_url: URL to receive call status updates
            agent_id: Agent ID to use for the call
            context: Additional context data
            
        Returns:
            Dict with call information
        """
        if not self.twilio_enabled:
            return {
                "success": False,
                "error": "Twilio not configured",
                "message": "Telephony service is not available. Please configure Twilio credentials."
            }
        
        try:
            from_number = from_number or self.twilio_phone_number
            if not from_number:
                return {
                    "success": False,
                    "error": "No phone number configured",
                    "message": "TWILIO_PHONE_NUMBER not set"
                }
            
            # Build webhook URL with agent context
            if webhook_url:
                # Add agent_id and context to webhook URL
                params = []
                if agent_id:
                    params.append(f"agent_id={agent_id}")
                if context:
                    import urllib.parse
                    params.append(f"context={urllib.parse.quote(json.dumps(context))}")
                
                if params:
                    separator = "&" if "?" in webhook_url else "?"
                    webhook_url = f"{webhook_url}{separator}{'&'.join(params)}"
            
            call = self.twilio_client.calls.create(
                to=to_number,
                from_=from_number,
                url=webhook_url or f"{os.getenv('API_BASE_URL', 'http://localhost:8001')}/api/ivr/call-handler",
                method="POST"
            )
            
            return {
                "success": True,
                "call_sid": call.sid,
                "status": call.status,
                "to": to_number,
                "from": from_number,
                "message": "Call initiated successfully"
            }
        except Exception as e:
            logger.error(f"Error making call: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to initiate call"
            }
    
    async def send_sms(
        self,
        to_number: str,
        message: str,
        from_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send an SMS message
        
        Args:
            to_number: Phone number to send to (E.164 format)
            message: Message content
            from_number: Phone number to send from (defaults to TWILIO_PHONE_NUMBER)
            
        Returns:
            Dict with SMS information
        """
        if not self.twilio_enabled:
            return {
                "success": False,
                "error": "Twilio not configured"
            }
        
        try:
            from_number = from_number or self.twilio_phone_number
            message = self.twilio_client.messages.create(
                to=to_number,
                from_=from_number,
                body=message
            )
            
            return {
                "success": True,
                "message_sid": message.sid,
                "status": message.status,
                "to": to_number,
                "from": from_number
            }
        except Exception as e:
            logger.error(f"Error sending SMS: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    def generate_ivr_twiml(
        self,
        message: str,
        gather_input: bool = True,
        num_digits: int = 1,
        action_url: Optional[str] = None,
        finish_on_key: str = "#",
        timeout: int = 5
    ) -> str:
        """
        Generate TwiML for IVR voice response
        
        Args:
            message: Text to speak to caller
            gather_input: Whether to gather DTMF input
            num_digits: Number of digits to collect
            action_url: URL to send input to
            finish_on_key: Key that finishes input collection
            timeout: Timeout in seconds
            
        Returns:
            TwiML XML string
        """
        if not TWILIO_AVAILABLE:
            return '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service unavailable</Say></Response>'
        
        response = VoiceResponse()
        
        if gather_input:
            gather = Gather(
                num_digits=num_digits,
                action=action_url or "",
                finish_on_key=finish_on_key,
                timeout=timeout,
                input="dtmf"
            )
            gather.say(message, voice="alice", language="en-US")
            response.append(gather)
        else:
            response.say(message, voice="alice", language="en-US")
        
        # Fallback if no input
        if gather_input:
            response.say("We didn't receive your input. Please try again.", voice="alice", language="en-US")
            response.redirect(action_url or "")
        
        return str(response)
    
    def generate_voice_twiml(
        self,
        message: str,
        record: bool = False,
        transcribe: bool = False,
        action_url: Optional[str] = None
    ) -> str:
        """
        Generate TwiML for voice response with optional recording/transcription
        
        Args:
            message: Text to speak
            record: Whether to record the call
            transcribe: Whether to transcribe the recording
            action_url: URL to send recording/transcription to
            
        Returns:
            TwiML XML string
        """
        if not TWILIO_AVAILABLE:
            return '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service unavailable</Say></Response>'
        
        response = VoiceResponse()
        response.say(message, voice="alice", language="en-US")
        
        if record:
            response.record(
                recording_status_callback=action_url,
                transcribe=transcribe,
                transcribe_callback=action_url if transcribe else None
            )
        
        return str(response)
    
    def transfer_call(
        self,
        call_sid: str,
        to_number: str,
        from_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transfer an active call to another number
        
        Args:
            call_sid: Twilio Call SID
            to_number: Number to transfer to
            from_number: Number to transfer from (optional)
            
        Returns:
            Dict with transfer information
        """
        if not self.twilio_enabled:
            return {
                "success": False,
                "error": "Twilio not configured"
            }
        
        try:
            call = self.twilio_client.calls(call_sid)
            call.update(
                twiml=f'<Response><Dial><Number>{to_number}</Number></Dial></Response>'
            )
            
            return {
                "success": True,
                "call_sid": call_sid,
                "status": "transferred",
                "to": to_number
            }
        except Exception as e:
            logger.error(f"Error transferring call: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    def hangup_call(self, call_sid: str) -> Dict[str, Any]:
        """
        Hang up an active call
        
        Args:
            call_sid: Twilio Call SID
            
        Returns:
            Dict with hangup information
        """
        if not self.twilio_enabled:
            return {
                "success": False,
                "error": "Twilio not configured"
            }
        
        try:
            call = self.twilio_client.calls(call_sid)
            call.update(status="completed")
            
            return {
                "success": True,
                "call_sid": call_sid,
                "status": "completed"
            }
        except Exception as e:
            logger.error(f"Error hanging up call: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_call_status(self, call_sid: str) -> Dict[str, Any]:
        """
        Get status of a call
        
        Args:
            call_sid: Twilio Call SID
            
        Returns:
            Dict with call status information
        """
        if not self.twilio_enabled:
            return {
                "success": False,
                "error": "Twilio not configured"
            }
        
        try:
            call = self.twilio_client.calls(call_sid).fetch()
            
            return {
                "success": True,
                "call_sid": call.sid,
                "status": call.status,
                "direction": call.direction,
                "from": call.from_,
                "to": call.to,
                "duration": call.duration,
                "start_time": call.start_time.isoformat() if call.start_time else None,
                "end_time": call.end_time.isoformat() if call.end_time else None
            }
        except Exception as e:
            logger.error(f"Error getting call status: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }


# Global instance
telephony_service = TelephonyService()

