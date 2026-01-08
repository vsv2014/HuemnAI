"""
Ticket Booking Agent Service

Handles ticket booking across multiple platforms:
- Flight tickets
- Train tickets
- Bus tickets
- Restaurant reservations
- Food delivery bookings
- Event tickets
- Hotel bookings

Features:
- Price comparison across platforms
- Best price finding
- User detail collection
- Ticket booking
- Payment processing
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import random

logger = logging.getLogger(__name__)

# Mock platforms for different ticket types
FLIGHT_PLATFORMS = ["Expedia", "Kayak", "Skyscanner", "Google Flights", "CheapOair"]
TRAIN_PLATFORMS = ["Railway", "Trainline", "Amtrak", "Rail Europe", "TrainPal"]
BUS_PLATFORMS = ["Greyhound", "Megabus", "FlixBus", "BoltBus", "RedCoach"]
RESTAURANT_PLATFORMS = ["OpenTable", "Resy", "Yelp Reservations", "Bookatable", "TheFork"]
FOOD_PLATFORMS = ["Uber Eats", "DoorDash", "Grubhub", "Postmates", "Deliveroo"]
EVENT_PLATFORMS = ["Ticketmaster", "StubHub", "Eventbrite", "SeatGeek", "Vivid Seats"]
HOTEL_PLATFORMS = ["Booking.com", "Expedia", "Hotels.com", "Agoda", "Trivago"]


# Image URLs for different ticket types
TICKET_TYPE_IMAGES = {
    "flight": "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=300&fit=crop",
    "train": "https://images.unsplash.com/photo-1551590192-8070a16d9f67?w=400&h=300&fit=crop",
    "bus": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&h=300&fit=crop",
    "restaurant": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop",
    "food": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop",
    "hotel": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop",
    "event": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=300&fit=crop",
    "general": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop"
}

# Platform logos (using placeholder URLs - in production, use actual platform logos)
PLATFORM_IMAGES = {
    "Expedia": "https://logos-world.net/wp-content/uploads/2020/11/Expedia-Logo.png",
    "Kayak": "https://logos-world.net/wp-content/uploads/2020/11/Kayak-Logo.png",
    "Skyscanner": "https://logos-world.net/wp-content/uploads/2020/11/Skyscanner-Logo.png",
    "Google Flights": "https://logos-world.net/wp-content/uploads/2020/11/Google-Flights-Logo.png",
    "CheapOair": "https://logos-world.net/wp-content/uploads/2020/11/CheapOair-Logo.png",
    "Railway": "https://via.placeholder.com/100x50/0066CC/FFFFFF?text=Railway",
    "Trainline": "https://logos-world.net/wp-content/uploads/2020/11/Trainline-Logo.png",
    "Amtrak": "https://logos-world.net/wp-content/uploads/2020/11/Amtrak-Logo.png",
    "Greyhound": "https://logos-world.net/wp-content/uploads/2020/11/Greyhound-Logo.png",
    "Megabus": "https://logos-world.net/wp-content/uploads/2020/11/Megabus-Logo.png",
    "OpenTable": "https://logos-world.net/wp-content/uploads/2020/11/OpenTable-Logo.png",
    "Resy": "https://logos-world.net/wp-content/uploads/2020/11/Resy-Logo.png",
    "Uber Eats": "https://logos-world.net/wp-content/uploads/2020/11/Uber-Eats-Logo.png",
    "DoorDash": "https://logos-world.net/wp-content/uploads/2020/11/DoorDash-Logo.png",
    "Booking.com": "https://logos-world.net/wp-content/uploads/2020/11/Booking-Logo.png",
    "Ticketmaster": "https://logos-world.net/wp-content/uploads/2020/11/Ticketmaster-Logo.png",
    "StubHub": "https://logos-world.net/wp-content/uploads/2020/11/StubHub-Logo.png"
}


def detect_ticket_type(query: str) -> str:
    """Detect the type of ticket from user query."""
    query_lower = query.lower()
    
    if any(word in query_lower for word in ["flight", "airplane", "airline", "fly", "airport"]):
        return "flight"
    elif any(word in query_lower for word in ["train", "railway", "rail", "locomotive"]):
        return "train"
    elif any(word in query_lower for word in ["bus", "coach", "shuttle"]):
        return "bus"
    elif any(word in query_lower for word in ["restaurant", "dine", "dining", "reservation", "table"]):
        return "restaurant"
    elif any(word in query_lower for word in ["food", "delivery", "order food", "takeout"]):
        return "food"
    elif any(word in query_lower for word in ["hotel", "accommodation", "stay", "lodging"]):
        return "hotel"
    elif any(word in query_lower for word in ["event", "concert", "show", "theater", "sports"]):
        return "event"
    else:
        return "general"


def get_ticket_type_image(ticket_type: str) -> str:
    """Get image URL for ticket type."""
    return TICKET_TYPE_IMAGES.get(ticket_type, TICKET_TYPE_IMAGES["general"])


def get_platform_image(platform: str) -> str:
    """Get logo/image URL for platform."""
    return PLATFORM_IMAGES.get(platform, "https://via.placeholder.com/100x50/666666/FFFFFF?text=" + platform.replace(" ", "+"))


async def search_tickets(
    ticket_type: str,
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    date: Optional[str] = None,
    passengers: int = 1,
    user_location: Optional[Dict[str, str]] = None,
    currency: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Search for tickets across multiple platforms and compare prices.
    Uses real-time APIs when available, falls back to mock data.
    
    Returns best options with price comparison in user's local currency.
    """
    from app.services.location_service import (
        detect_location_from_ip, get_currency_symbol, convert_currency
    )
    from app.services.real_price_apis import (
        search_flights_real, search_trains_real, search_buses_real,
        search_restaurants_real, search_hotels_real, search_events_real
    )
    
    # Detect user location and currency if not provided
    if not user_location:
        user_location = detect_location_from_ip()
    if not currency:
        currency = user_location.get("currency", "USD")
    
    currency_symbol = get_currency_symbol(currency)
    
    platforms = []
    if ticket_type == "flight":
        platforms = FLIGHT_PLATFORMS
    elif ticket_type == "train":
        platforms = TRAIN_PLATFORMS
    elif ticket_type == "bus":
        platforms = BUS_PLATFORMS
    elif ticket_type == "restaurant":
        platforms = RESTAURANT_PLATFORMS
    elif ticket_type == "food":
        platforms = FOOD_PLATFORMS
    elif ticket_type == "hotel":
        platforms = HOTEL_PLATFORMS
    elif ticket_type == "event":
        platforms = EVENT_PLATFORMS
    else:
        platforms = FLIGHT_PLATFORMS  # Default
    
    # Try to get real prices first
    results = []
    real_results = []
    
    try:
        if ticket_type == "flight" and origin and destination:
            real_results = await search_flights_real(origin, destination, date or "", passengers, currency)
        elif ticket_type == "train" and origin and destination:
            real_results = await search_trains_real(origin, destination, date or "", passengers, currency)
        elif ticket_type == "bus" and origin and destination:
            real_results = await search_buses_real(origin, destination, date or "", passengers, currency)
        elif ticket_type == "restaurant":
            # For restaurants, use location or origin as search term
            location = origin or destination or (user_location.get("country") if user_location else "United States")
            real_results = await search_restaurants_real(location, None, date, passengers, currency)
        elif ticket_type == "hotel" and origin:
            real_results = await search_hotels_real(origin, date or "", date or "", passengers, currency)
        elif ticket_type == "event" and origin:
            real_results = await search_events_real(origin, None, date, currency)
    except Exception as e:
        logger.warning(f"Error fetching real prices: {e}")
    
    # If we got real results, use them; otherwise generate mock data
    if real_results:
        results = real_results
    else:
        # Generate mock search results with price comparison (in user's currency)
        # Adjust base prices based on currency (rough estimates)
        currency_multipliers = {
            "USD": 1.0, "INR": 83.0, "GBP": 0.8, "EUR": 0.92, "JPY": 150.0,
            "CAD": 1.35, "AUD": 1.5, "CNY": 7.2, "KRW": 1300.0, "SGD": 1.35
        }
        multiplier = currency_multipliers.get(currency, 1.0)
        
        base_price_usd = random.randint(50, 500) if ticket_type in ["flight", "hotel"] else random.randint(10, 150)
        base_price = base_price_usd * multiplier
    
        for i, platform in enumerate(platforms[:5]):  # Top 5 platforms
            # Simulate price variation
            price_variation = random.uniform(0.85, 1.15)
            price = round(base_price * price_variation, 2)
            
            # Add platform-specific features
            features = []
            if ticket_type == "flight":
                features = ["Free cancellation", "Seat selection", "Baggage included"]
            elif ticket_type == "train":
                features = ["Flexible ticket", "WiFi", "Seat reservation"]
            elif ticket_type == "bus":
                features = ["Reclining seats", "WiFi", "Power outlets"]
            elif ticket_type == "restaurant":
                features = ["Instant confirmation", "No deposit", "Flexible timing"]
            elif ticket_type == "food":
                features = ["Fast delivery", "Free delivery", "Promo code available"]
            elif ticket_type == "hotel":
                features = ["Free WiFi", "Breakfast included", "Free cancellation"]
            elif ticket_type == "event":
                features = ["Instant download", "Mobile ticket", "Secure payment"]
            
            results.append({
                "platform": platform,
                "price": price,
                "currency": currency,
                "currency_symbol": currency_symbol,
                "available": True,
                "features": features[:2],  # Top 2 features
                "rating": round(random.uniform(3.5, 5.0), 1),
                "booking_url": f"https://{platform.lower().replace(' ', '')}.com/book",
                "estimated_time": f"{random.randint(1, 24)} hours" if ticket_type in ["flight", "train", "bus"] else "Instant",
                "platform_image": get_platform_image(platform),
                "ticket_type_image": get_ticket_type_image(ticket_type)
            })
    
    # Sort by price (lowest first)
    results.sort(key=lambda x: x["price"])
    
    best_option = results[0] if results else None
    price_range = {
        "lowest": results[0]["price"] if results else 0,
        "highest": results[-1]["price"] if results else 0,
        "average": sum(r["price"] for r in results) / len(results) if results else 0
    }
    
    return {
        "ticket_type": ticket_type,
        "ticket_type_image": get_ticket_type_image(ticket_type),
        "search_params": {
            "origin": origin,
            "destination": destination,
            "date": date,
            "passengers": passengers
        },
        "results": results,
        "best_option": best_option,
        "price_comparison": price_range,
        "total_options": len(results),
        "search_timestamp": datetime.now().isoformat(),
        "currency": currency,
        "currency_symbol": currency_symbol,
        "user_location": user_location,
        "is_real_time": len(real_results) > 0
    }


def collect_booking_details(ticket_type: str, user_query: str) -> Dict[str, Any]:
    """
    Extract booking details from user query using intelligent parsing.
    Returns required and optional fields for booking.
    """
    required_fields = []
    optional_fields = []
    
    if ticket_type in ["flight", "train", "bus"]:
        required_fields = [
            {"name": "origin", "label": "Origin/Location", "type": "text"},
            {"name": "destination", "label": "Destination", "type": "text"},
            {"name": "date", "label": "Travel Date", "type": "date"},
            {"name": "passengers", "label": "Number of Passengers", "type": "number"},
            {"name": "name", "label": "Full Name", "type": "text"},
            {"name": "email", "label": "Email Address", "type": "email"},
            {"name": "phone", "label": "Phone Number", "type": "tel"}
        ]
        optional_fields = [
            {"name": "return_date", "label": "Return Date (if round trip)", "type": "date"},
            {"name": "preferred_time", "label": "Preferred Time", "type": "time"},
            {"name": "special_requests", "label": "Special Requests", "type": "textarea"}
        ]
    elif ticket_type == "restaurant":
        required_fields = [
            {"name": "restaurant_name", "label": "Restaurant Name", "type": "text"},
            {"name": "date", "label": "Reservation Date", "type": "date"},
            {"name": "time", "label": "Reservation Time", "type": "time"},
            {"name": "guests", "label": "Number of Guests", "type": "number"},
            {"name": "name", "label": "Full Name", "type": "text"},
            {"name": "email", "label": "Email Address", "type": "email"},
            {"name": "phone", "label": "Phone Number", "type": "tel"}
        ]
        optional_fields = [
            {"name": "special_requests", "label": "Dietary Restrictions or Special Requests", "type": "textarea"},
            {"name": "occasion", "label": "Occasion (Birthday, Anniversary, etc.)", "type": "text"}
        ]
    elif ticket_type == "food":
        required_fields = [
            {"name": "restaurant_name", "label": "Restaurant/Food Type", "type": "text"},
            {"name": "delivery_address", "label": "Delivery Address", "type": "textarea"},
            {"name": "delivery_time", "label": "Preferred Delivery Time", "type": "datetime"},
            {"name": "name", "label": "Full Name", "type": "text"},
            {"name": "email", "label": "Email Address", "type": "email"},
            {"name": "phone", "label": "Phone Number", "type": "tel"}
        ]
        optional_fields = [
            {"name": "payment_method", "label": "Payment Method", "type": "select", "options": ["Credit Card", "PayPal", "Cash on Delivery"]},
            {"name": "special_instructions", "label": "Special Instructions", "type": "textarea"}
        ]
    elif ticket_type == "hotel":
        required_fields = [
            {"name": "location", "label": "Hotel Location/City", "type": "text"},
            {"name": "check_in", "label": "Check-in Date", "type": "date"},
            {"name": "check_out", "label": "Check-out Date", "type": "date"},
            {"name": "guests", "label": "Number of Guests", "type": "number"},
            {"name": "name", "label": "Full Name", "type": "text"},
            {"name": "email", "label": "Email Address", "type": "email"},
            {"name": "phone", "label": "Phone Number", "type": "tel"}
        ]
        optional_fields = [
            {"name": "room_type", "label": "Room Type Preference", "type": "select", "options": ["Standard", "Deluxe", "Suite"]},
            {"name": "special_requests", "label": "Special Requests", "type": "textarea"}
        ]
    elif ticket_type == "event":
        required_fields = [
            {"name": "event_name", "label": "Event Name", "type": "text"},
            {"name": "date", "label": "Event Date", "type": "date"},
            {"name": "quantity", "label": "Number of Tickets", "type": "number"},
            {"name": "name", "label": "Full Name", "type": "text"},
            {"name": "email", "label": "Email Address", "type": "email"},
            {"name": "phone", "label": "Phone Number", "type": "tel"}
        ]
        optional_fields = [
            {"name": "seat_preference", "label": "Seat Preference", "type": "select", "options": ["Best Available", "Front", "Middle", "Back"]},
            {"name": "special_requests", "label": "Special Requests", "type": "textarea"}
        ]
    else:
        required_fields = [
            {"name": "service_type", "label": "Service Type", "type": "text"},
            {"name": "name", "label": "Full Name", "type": "text"},
            {"name": "email", "label": "Email Address", "type": "email"},
            {"name": "phone", "label": "Phone Number", "type": "tel"}
        ]
    
    return {
        "ticket_type": ticket_type,
        "required_fields": required_fields,
        "optional_fields": optional_fields,
        "message": f"I'll help you book {ticket_type} tickets. I need a few details from you to proceed."
    }


def book_ticket(
    ticket_type: str,
    platform: str,
    booking_details: Dict[str, Any],
    payment_info: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Book a ticket on the selected platform.
    In production, this would integrate with actual booking APIs.
    """
    booking_id = f"BK{random.randint(100000, 999999)}"
    
    # Simulate booking process
    booking_status = "confirmed"
    confirmation_code = f"{platform[:3].upper()}{random.randint(1000, 9999)}"
    
    booking_result = {
        "booking_id": booking_id,
        "ticket_type": ticket_type,
        "platform": platform,
        "status": booking_status,
        "confirmation_code": confirmation_code,
        "booking_details": booking_details,
        "payment_status": "completed" if payment_info else "pending",
        "booking_timestamp": datetime.now().isoformat(),
        "message": f"Your {ticket_type} ticket has been successfully booked! Confirmation code: {confirmation_code}"
    }
    
    logger.info(f"Ticket booked: {booking_id} on {platform} for {ticket_type}")
    
    return booking_result


def process_payment(
    amount: float,
    currency: str = "USD",
    payment_method: str = "credit_card",
    payment_details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Process payment for ticket booking.
    In production, this would integrate with payment gateways (Stripe, PayPal, etc.).
    """
    transaction_id = f"TXN{random.randint(100000, 999999)}"
    
    # Simulate payment processing
    payment_status = "completed"
    
    return {
        "transaction_id": transaction_id,
        "amount": amount,
        "currency": currency,
        "payment_method": payment_method,
        "status": payment_status,
        "timestamp": datetime.now().isoformat(),
        "message": f"Payment of {currency} {amount} processed successfully. Transaction ID: {transaction_id}"
    }


async def handle_booking_query(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main handler for ticket booking queries with LLM integration.
    Routes to appropriate service based on query intent and uses LLM for natural responses.
    Supports location detection and real-time price comparison.
    """
    user_query = payload.get("message", "")
    user_id = payload.get("user_id", "anonymous")
    conversation_history = payload.get("conversation_history", [])
    user_location = payload.get("user_location")  # From frontend
    user_ip = payload.get("user_ip")  # Optional IP for location detection
    
    if not user_query:
        return {
            "type": "ERROR",
            "message": "Please provide a query about ticket booking."
        }
    
    # Detect ticket type
    ticket_type = detect_ticket_type(user_query)
    
    # Check if user wants to search or book
    query_lower = user_query.lower()
    wants_to_book = any(word in query_lower for word in ["book", "reserve", "buy", "purchase", "get ticket"])
    wants_to_search = any(word in query_lower for word in ["search", "find", "compare", "price", "cheap", "best", "need"])
    
    # Use LLM to generate natural response
    try:
        from app.services.llm_service import explain
        
        if wants_to_book:
            # User wants to book - collect details
            details = collect_booking_details(ticket_type, user_query)
            
            # Generate natural LLM response
            llm_prompt = f"""The user wants to book {ticket_type} tickets. Generate a friendly, helpful response that:
1. Acknowledges their request warmly
2. Explains that you'll help them book the ticket
3. Mentions you need some details to proceed
4. Be conversational and human-like, not robotic

User's message: "{user_query}"
Ticket type: {ticket_type}

Generate a natural, friendly response:"""
            
            llm_message = ""
            async for token in explain(llm_prompt):
                llm_message += token
            
            # Check if LLM returned configuration error (check early, before any fallback)
            llm_message_lower = llm_message.lower()
            if "not configured" in llm_message_lower or "⚠️" in llm_message or "settings" in llm_message_lower or "api key" in llm_message_lower:
                return {
                    "type": "ERROR",
                    "message": llm_message.strip() if llm_message.strip() else "⚠️ LLM API key not configured. Please configure your LLM provider in Settings to use this feature. Go to Settings → Add Configuration → LLM Provider → OpenAI (or Azure/Anthropic).",
                    "requires_config": True,
                    "config_url": "/settings"
                }
            
            # If message is too short or empty, it's likely an error - don't use fallback
            if not llm_message or len(llm_message.strip()) < 20:
                return {
                    "type": "ERROR",
                    "message": "⚠️ LLM API key not configured. Please configure your LLM provider in Settings to use this feature. Go to Settings → Add Configuration → LLM Provider → OpenAI (or Azure/Anthropic).",
                    "requires_config": True,
                    "config_url": "/settings"
                }
            
            return {
                "type": "COLLECT_DETAILS",
                "ticket_type": ticket_type,
                "ticket_type_image": get_ticket_type_image(ticket_type),
                "message": llm_message.strip(),
                "required_fields": details["required_fields"],
                "optional_fields": details["optional_fields"]
            }
        elif wants_to_search or "ticket" in query_lower:
            # User wants to search - perform search
            origin = None
            destination = None
            date = None
            
            # Simple extraction (in production, use NLP)
            words = user_query.split()
            for i, word in enumerate(words):
                if word.lower() in ["from", "origin"] and i + 1 < len(words):
                    origin = words[i + 1]
                elif word.lower() in ["to", "destination"] and i + 1 < len(words):
                    destination = words[i + 1]
                elif word.lower() in ["on", "date"] and i + 1 < len(words):
                    date = words[i + 1]
            
            # Detect location if not provided
            if not user_location:
                from app.services.location_service import detect_location_from_ip
                user_location = detect_location_from_ip(user_ip)
            
            results = await search_tickets(
                ticket_type=ticket_type,
                origin=origin,
                destination=destination,
                date=date,
                passengers=1,
                user_location=user_location,
                currency=user_location.get("currency") if user_location else None
            )
            
            best = results["best_option"]
            currency_symbol = results.get("currency_symbol", "$")
            currency = results.get("currency", "USD")
            
            # Generate natural LLM response with search results
            llm_prompt = f"""The user asked about {ticket_type} tickets. I found {results['total_options']} options. The best price is {currency_symbol}{best['price']} ({currency}) on {best['platform']}. 

Generate a friendly, helpful response that:
1. Acknowledges their search request
2. Mentions the number of options found
3. Highlights the best deal naturally
4. Asks if they'd like to book
5. Be conversational and enthusiastic, not robotic

User's message: "{user_query}"
Best option: {best['platform']} - ${best['price']}
Total options: {results['total_options']}

Generate a natural, friendly response:"""
            
            llm_message = ""
            async for token in explain(llm_prompt):
                llm_message += token
            
            # Check if LLM returned configuration error (check early, before any fallback)
            llm_message_lower = llm_message.lower()
            if "not configured" in llm_message_lower or "⚠️" in llm_message or "settings" in llm_message_lower or "api key" in llm_message_lower:
                return {
                    "type": "ERROR",
                    "message": llm_message.strip() if llm_message.strip() else "⚠️ LLM API key not configured. Please configure your LLM provider in Settings to use this feature. Go to Settings → Add Configuration → LLM Provider → OpenAI (or Azure/Anthropic).",
                    "requires_config": True,
                    "config_url": "/settings"
                }
            
            # If message is too short or empty, it's likely an error - don't use fallback
            if not llm_message or len(llm_message.strip()) < 20:
                return {
                    "type": "ERROR",
                    "message": "⚠️ LLM API key not configured. Please configure your LLM provider in Settings to use this feature. Go to Settings → Add Configuration → LLM Provider → OpenAI (or Azure/Anthropic).",
                    "requires_config": True,
                    "config_url": "/settings"
                }
            
            return {
                "type": "SEARCH_RESULTS",
                "ticket_type": ticket_type,
                "ticket_type_image": get_ticket_type_image(ticket_type),
                "message": llm_message.strip(),
                "results": results["results"],
                "best_option": best,
                "price_comparison": results["price_comparison"],
                "total_options": results["total_options"],
                "currency": currency,
                "currency_symbol": currency_symbol
            }
        else:
            # General inquiry - provide information with LLM
            llm_prompt = f"""The user is asking about {ticket_type} tickets. Generate a friendly, helpful response that:
1. Acknowledges their interest
2. Explains what you can help with (search, compare, book)
3. Asks what they'd like to do
4. Be conversational and helpful, not robotic

User's message: "{user_query}"
Ticket type: {ticket_type}

Generate a natural, friendly response:"""
            
            llm_message = ""
            async for token in explain(llm_prompt):
                llm_message += token
            
            # Check if LLM returned configuration error (check early, before any fallback)
            llm_message_lower = llm_message.lower()
            if "not configured" in llm_message_lower or "⚠️" in llm_message or "settings" in llm_message_lower or "api key" in llm_message_lower:
                return {
                    "type": "ERROR",
                    "message": llm_message.strip() if llm_message.strip() else "⚠️ LLM API key not configured. Please configure your LLM provider in Settings to use this feature. Go to Settings → Add Configuration → LLM Provider → OpenAI (or Azure/Anthropic).",
                    "requires_config": True,
                    "config_url": "/settings"
                }
            
            # If message is too short or empty, it's likely an error - don't use fallback
            if not llm_message or len(llm_message.strip()) < 20:
                return {
                    "type": "ERROR",
                    "message": "⚠️ LLM API key not configured. Please configure your LLM provider in Settings to use this feature. Go to Settings → Add Configuration → LLM Provider → OpenAI (or Azure/Anthropic).",
                    "requires_config": True,
                    "config_url": "/settings"
                }
            
            # Get currency from user location if available
            currency = "USD"
            currency_symbol = "$"
            if user_location:
                currency = user_location.get("currency", "USD")
                from app.services.location_service import get_currency_symbol
                currency_symbol = get_currency_symbol(currency)
            
            return {
                "type": "INFO",
                "ticket_type": ticket_type,
                "ticket_type_image": get_ticket_type_image(ticket_type),
                "message": llm_message.strip(),
                "capabilities": [
                    "Search across multiple platforms",
                    "Compare prices to find the best deal",
                    "Book tickets with all necessary details",
                    "Process secure payments"
                ],
                "currency": currency,
                "currency_symbol": currency_symbol
            }
    except Exception as e:
        logger.error(f"Error in handle_booking_query with LLM: {e}", exc_info=True)
        
        # Check if error is due to missing LLM configuration
        error_str = str(e).lower()
        if "not configured" in error_str or "api key" in error_str or "settings" in error_str or "⚠️" in str(e):
            return {
                "type": "ERROR",
                "message": "⚠️ LLM API key not configured. Please configure your LLM provider in Settings to use this feature. Go to Settings → Add Configuration → LLM Provider → OpenAI (or Azure/Anthropic).",
                "requires_config": True,
                "config_url": "/settings"
            }
        
        # NO FALLBACK - Return error if LLM fails for any reason
        return {
            "type": "ERROR",
            "message": "⚠️ LLM API key not configured. Please configure your LLM provider in Settings to use this feature. Go to Settings → Add Configuration → LLM Provider.",
            "requires_config": True,
            "config_url": "/settings"
        }

