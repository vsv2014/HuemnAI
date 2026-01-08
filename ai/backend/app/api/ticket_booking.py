"""
Ticket Booking API Endpoints

Handles ticket booking requests:
- Search tickets across platforms
- Compare prices
- Collect booking details
- Book tickets
- Process payments
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from app.services.ticket_booking_service import (
    detect_ticket_type,
    search_tickets,
    collect_booking_details,
    book_ticket,
    process_payment
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class TicketSearchRequest(BaseModel):
    query: str
    ticket_type: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    date: Optional[str] = None
    passengers: int = 1


class BookingDetailsRequest(BaseModel):
    ticket_type: str
    user_query: str


class BookTicketRequest(BaseModel):
    ticket_type: str
    platform: str
    booking_details: Dict[str, Any]
    payment_info: Optional[Dict[str, Any]] = None


class PaymentRequest(BaseModel):
    amount: float
    currency: str = "USD"
    payment_method: str = "credit_card"
    payment_details: Optional[Dict[str, Any]] = None


@router.post("/search")
async def search_ticket_options(request: TicketSearchRequest):
    """
    Search for tickets across multiple platforms and compare prices.
    Returns best options with price comparison.
    """
    try:
        # Auto-detect ticket type if not provided
        ticket_type = request.ticket_type or detect_ticket_type(request.query)
        
        from app.services.ticket_booking_service import search_tickets
        results = await search_tickets(
            ticket_type=ticket_type,
            origin=request.origin,
            destination=request.destination,
            date=request.date,
            passengers=request.passengers,
            user_location=request.user_location,
            user_ip=request.user_ip
        )
        
        currency_symbol = results.get("currency_symbol", "$")
        currency = results.get("currency", "USD")
        
        return {
            "success": True,
            "data": results,
            "message": f"Found {results['total_options']} options for {ticket_type} tickets. Best price: {currency_symbol}{results['best_option']['price']} ({currency}) on {results['best_option']['platform']}"
        }
    except Exception as e:
        logger.error(f"Error searching tickets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error searching tickets: {str(e)}")


@router.post("/collect-details")
async def get_booking_details(request: BookingDetailsRequest):
    """
    Get required and optional fields for booking based on ticket type.
    """
    try:
        details = collect_booking_details(request.ticket_type, request.user_query)
        return {
            "success": True,
            "data": details,
            "message": details["message"]
        }
    except Exception as e:
        logger.error(f"Error collecting booking details: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error collecting booking details: {str(e)}")


@router.post("/book")
async def book_ticket_endpoint(request: BookTicketRequest):
    """
    Book a ticket on the selected platform.
    """
    try:
        booking_result = book_ticket(
            ticket_type=request.ticket_type,
            platform=request.platform,
            booking_details=request.booking_details,
            payment_info=request.payment_info
        )
        
        return {
            "success": True,
            "data": booking_result,
            "message": booking_result["message"]
        }
    except Exception as e:
        logger.error(f"Error booking ticket: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error booking ticket: {str(e)}")


@router.post("/payment")
async def process_payment_endpoint(request: PaymentRequest):
    """
    Process payment for ticket booking.
    """
    try:
        payment_result = process_payment(
            amount=request.amount,
            currency=request.currency,
            payment_method=request.payment_method,
            payment_details=request.payment_details
        )
        
        return {
            "success": True,
            "data": payment_result,
            "message": payment_result["message"]
        }
    except Exception as e:
        logger.error(f"Error processing payment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing payment: {str(e)}")


class BookingQueryRequest(BaseModel):
    message: str
    user_id: Optional[str] = "anonymous"
    conversation_history: Optional[List[Dict[str, Any]]] = None
    user_location: Optional[Dict[str, str]] = None  # {"country_code": "IN", "currency": "INR", "country": "India"}
    user_ip: Optional[str] = None  # For location detection


@router.post("/handle-query")
async def handle_booking_query_endpoint(request: BookingQueryRequest):
    """
    Intelligent handler for ticket booking queries with LLM integration.
    Detects intent and guides user through booking process.
    """
    try:
        # Use the service function (now async with LLM)
        from app.services.ticket_booking_service import handle_booking_query
        payload = {
            "message": request.message,
            "user_id": request.user_id,
            "conversation_history": request.conversation_history or [],
            "user_location": request.user_location,
            "user_ip": request.user_ip
        }
        return await handle_booking_query(payload)
    except Exception as e:
        logger.error(f"Error handling booking query: {e}", exc_info=True)
        return {
            "type": "ERROR",
            "message": f"I encountered an error processing your request. Please try again or provide more details."
        }

