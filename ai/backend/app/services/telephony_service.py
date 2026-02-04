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
            
            # Determine webhook URL
            final_webhook_url = webhook_url or f"{os.getenv('API_BASE_URL', 'http://localhost:8001')}/api/ivr/call-handler"
            
            # Add agent_id and context to webhook URL
            params = []
            if agent_id:
                params.append(f"agent_id={agent_id}")
            if context:
                import urllib.parse
                params.append(f"context={urllib.parse.quote(json.dumps(context))}")
            
            if params:
                separator = "&" if "?" in final_webhook_url else "?"
                final_webhook_url = f"{final_webhook_url}{separator}{'&'.join(params)}"
            
            # Determine status callback URL
            api_base = os.getenv('API_BASE_URL', 'http://localhost:8001')
            status_callback_url = f"{api_base}/api/ivr/status-callback"

            call = self.twilio_client.calls.create(
                to=to_number,
                from_=from_number,
                url=final_webhook_url,
                method="POST",
                status_callback=status_callback_url,
                status_callback_event=['initiated', 'ringing', 'answered', 'completed'],
                status_callback_method='POST'
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
        timeout: int = 5,
        voice_id: Optional[str] = None
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
            voice_id: Optional HuemnVoice voice ID. If provided, uses <Play> with TTS endpoint.
            
        Returns:
            TwiML XML string
        """
        if not TWILIO_AVAILABLE:
            return '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service unavailable</Say></Response>'
        
        response = VoiceResponse()
        
        # Determine if we use HuemnVoice (Play) or Twilio (Say)
        use_huemn_voice = voice_id is not None
        
        if gather_input:
            gather = Gather(
                num_digits=num_digits,
                action=action_url or "",
                finish_on_key=finish_on_key,
                timeout=timeout,
                input="dtmf speech", # Enable speech input as well
                speechTimeout="auto"
            )
            
            if use_huemn_voice:
                import urllib.parse
                api_base = os.getenv('API_BASE_URL', 'http://localhost:8001')
                encoded_message = urllib.parse.quote(message)
                play_url = f"{api_base}/api/voice/twilio-speak?text={encoded_message}&voice_id={voice_id}"
                gather.play(play_url)
            else:
                gather.say(message, voice="alice", language="en-US")
                
            response.append(gather)
        else:
            if use_huemn_voice:
                import urllib.parse
                api_base = os.getenv('API_BASE_URL', 'http://localhost:8001')
                encoded_message = urllib.parse.quote(message)
                play_url = f"{api_base}/api/voice/twilio-speak?text={encoded_message}&voice_id={voice_id}"
                response.play(play_url)
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
    
    def generate_client_token(self, identity: str) -> str:
        """
        Generate a Twilio Client capability token (Access Token)
        
        Args:
            identity: Unique identity for this client (e.g., agent username/email)
            
        Returns:
            JWT Access Token string
        """
        if not self.twilio_enabled:
            return None
            
        try:
            from twilio.jwt.access_token import AccessToken
            from twilio.jwt.access_token.grants import VoiceGrant
            from app.core.config import settings
            
            # Use API Key/Secret if available (preferred for Access Tokens), otherwise Account SID/Auth Token
            # Note: AccessToken requires API Key SID and Secret, not Account SID/Auth Token
            api_key = settings.TWILIO_API_KEY_SID
            api_secret = settings.TWILIO_API_KEY_SECRET
            
            if not api_key or not api_secret:
                logger.error("Twilio API Key/Secret not configured. Cannot generate Access Token.")
                return None
                
            # Create access token with credentials
            token = AccessToken(
                self.twilio_account_sid,
                api_key,
                api_secret,
                identity=identity
            )
            
            # Create a Voice grant and add to token
            voice_grant = VoiceGrant(
                outgoing_application_sid=settings.TWILIO_APP_SID,
                incoming_allow=True # Allow incoming calls
            )
            token.add_grant(voice_grant)
            
            return token.to_jwt()
            
        except Exception as e:
            logger.error(f"Error generating client token: {str(e)}", exc_info=True)
            return None

    def bridge_to_client(self, call_sid: str, client_identity: str, parameters: Optional[Dict[str, str]] = None, record: bool = False) -> Dict[str, Any]:
        """
        Bridge a waiting call (e.g. in Queue) to a client (Agent)
        
        Args:
            call_sid: The SID of the waiting call
            client_identity: The identity of the client to connect to
            parameters: Optional custom parameters to pass to the client
            record: Whether to record the bridged call
            
        Returns:
            Dict with result
        """
        if not self.twilio_enabled:
            return {"success": False, "error": "Twilio not configured"}
            
        try:
            # We update the waiting call to Dial the Client
            # This effectively "dequeues" them by interrupting the <Enqueue> 
            # and executing this new TwiML
            
            # Construct TwiML with optional parameters
            response = VoiceResponse()
            
            dial_kwargs = {}
            if record:
                dial_kwargs["record"] = "record-from-ringing-dual"
                # Optional: Add recording status callback
                api_base = os.getenv('API_BASE_URL', 'http://localhost:8001')
                dial_kwargs["recording_status_callback"] = f"{api_base}/api/ivr/recording-callback"
            
            dial = response.dial(**dial_kwargs)
            client = dial.client(client_identity)
            
            if parameters:
                for name, value in parameters.items():
                    client.parameter(name=name, value=value)
            
            twiml = str(response)
            
            call = self.twilio_client.calls(call_sid).update(twiml=twiml)
            
            return {
                "success": True,
                "call_sid": call_sid,
                "status": "bridged",
                "to_client": client_identity
            }
        except Exception as e:
            logger.error(f"Error bridging call: {str(e)}", exc_info=True)
            return {"success": False, "error": str(e)}

    def redirect_call(self, call_sid: str, url: str = None, method: str = "POST") -> Dict[str, Any]:
        """
        Redirect a call to a new URL (TwiML).
        
        Args:
            call_sid: Twilio Call SID
            url: URL to redirect to
            method: HTTP method (POST or GET)
            
        Returns:
            Dict with redirect information
        """
        if not self.twilio_enabled:
            return {"success": False, "error": "Twilio not configured"}
            
        try:
            # If no URL is provided, we default to the main IVR entry point
            if not url:
                api_base = os.getenv('API_BASE_URL', 'http://localhost:8001')
                url = f"{api_base}/api/ivr/welcome"
                
            call = self.twilio_client.calls(call_sid).update(url=url, method=method)
            
            return {
                "success": True,
                "call_sid": call_sid,
                "status": "redirected",
                "to_url": url
            }
        except Exception as e:
            logger.error(f"Error redirecting call: {str(e)}", exc_info=True)
            return {"success": False, "error": str(e)}

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

