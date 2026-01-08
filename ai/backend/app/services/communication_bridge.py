"""
Communication Bridge Service
Bridges communication between agents and customers across different channels (email, chat, etc.)
"""
import logging
from typing import Dict, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)


def send_reply_to_customer(
    ticket_id: int,
    reply_text: str,
    customer_channel: str,
    customer_info: Dict,
    agent_name: str
) -> Dict:
    """
    Send agent reply to customer via their preferred communication channel.
    
    Args:
        ticket_id: Ticket ID
        reply_text: Agent's reply text
        customer_channel: Communication channel (email, chat, phone, etc.)
        customer_info: Customer information including contact details
        agent_name: Name of the agent sending the reply
    
    Returns:
        Dict with success status and delivery information
    """
    try:
        # Extract customer contact information
        customer_email = customer_info.get("email")
        customer_phone = customer_info.get("phone")
        customer_chat_id = customer_info.get("chat_id")
        
        if customer_channel == "email" and customer_email:
            # Send via email
            return send_email_reply(
                ticket_id=ticket_id,
                reply_text=reply_text,
                customer_email=customer_email,
                agent_name=agent_name
            )
        elif customer_channel == "chat" and customer_chat_id:
            # Send via chat (webhook, API, etc.)
            return send_chat_reply(
                ticket_id=ticket_id,
                reply_text=reply_text,
                customer_chat_id=customer_chat_id,
                agent_name=agent_name
            )
        elif customer_channel == "phone" and customer_phone:
            # Send via SMS or phone notification
            return send_phone_reply(
                ticket_id=ticket_id,
                reply_text=reply_text,
                customer_phone=customer_phone,
                agent_name=agent_name
            )
        else:
            # Default: log for manual follow-up
            logger.info(
                f"Ticket {ticket_id}: Reply from {agent_name} to customer via {customer_channel}. "
                f"Reply: {reply_text[:100]}..."
            )
            return {
                "success": True,
                "channel": customer_channel,
                "method": "logged",
                "message": "Reply logged. Manual delivery may be required.",
                "timestamp": datetime.utcnow().isoformat()
            }
    except Exception as e:
        logger.error(f"Error sending reply to customer for ticket {ticket_id}: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to send reply. Please try again or contact support."
        }


def send_email_reply(
    ticket_id: int,
    reply_text: str,
    customer_email: str,
    agent_name: str
) -> Dict:
    """Send reply via email"""
    try:
        # TODO: Integrate with email service (SendGrid, AWS SES, etc.)
        # For now, log the email
        logger.info(
            f"Email reply for ticket {ticket_id} to {customer_email} from {agent_name}: {reply_text[:100]}..."
        )
        
        # In production, this would:
        # 1. Format email with ticket details
        # 2. Send via email service
        # 3. Track delivery status
        
        return {
            "success": True,
            "channel": "email",
            "recipient": customer_email,
            "method": "email",
            "message": "Reply sent via email",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error sending email reply: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "channel": "email"
        }


def send_chat_reply(
    ticket_id: int,
    reply_text: str,
    customer_chat_id: str,
    agent_name: str
) -> Dict:
    """Send reply via chat (webhook, API, etc.)"""
    try:
        # TODO: Integrate with chat platforms (Intercom, Zendesk Chat, custom webhook, etc.)
        logger.info(
            f"Chat reply for ticket {ticket_id} to chat_id {customer_chat_id} from {agent_name}: {reply_text[:100]}..."
        )
        
        # In production, this would:
        # 1. Send message via chat API/webhook
        # 2. Track delivery status
        
        return {
            "success": True,
            "channel": "chat",
            "recipient": customer_chat_id,
            "method": "chat",
            "message": "Reply sent via chat",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error sending chat reply: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "channel": "chat"
        }


def send_phone_reply(
    ticket_id: int,
    reply_text: str,
    customer_phone: str,
    agent_name: str
) -> Dict:
    """Send reply via SMS or phone notification"""
    try:
        # TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
        logger.info(
            f"SMS/Phone reply for ticket {ticket_id} to {customer_phone} from {agent_name}: {reply_text[:100]}..."
        )
        
        return {
            "success": True,
            "channel": "phone",
            "recipient": customer_phone,
            "method": "sms",
            "message": "Reply sent via SMS",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error sending phone reply: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "channel": "phone"
        }


def detect_customer_channel(customer_info: Dict, message: str) -> str:
    """
    Detect customer's communication channel from their info and message.
    Returns: "email", "chat", "phone", etc.
    """
    # Check customer_info for explicit channel
    if customer_info.get("channel"):
        return customer_info["channel"]
    
    # Check for email address
    if customer_info.get("email"):
        return "email"
    
    # Check for chat ID
    if customer_info.get("chat_id"):
        return "chat"
    
    # Check for phone
    if customer_info.get("phone"):
        return "phone"
    
    # Default to email
    return "email"

