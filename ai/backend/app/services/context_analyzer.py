from typing import Dict, List, Optional
from app.services.emotion_service import analyze_tone, generate_appropriate_response, determine_priority_from_tone
from app.services.language_detection import detect_ticket_intent_multilang, detect_language

def analyze_user_intent(message: str, conversation_history: List[Dict] = None) -> Dict:
    """
    Analyze user's intent and context from their message.
    """
    message_lower = message.lower()
    
    intent = {
        "wants_ticket": False,
        "wants_info": False,
        "wants_solution": False,
        "wants_status": False,
        "is_greeting": False,
        "is_farewell": False,
        "needs_help": False
    }
    
    # Greeting detection
    greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"]
    if any(greeting in message_lower for greeting in greetings):
        intent["is_greeting"] = True
    
    # Farewell detection
    farewells = ["bye", "goodbye", "thanks", "thank you", "done", "that's all"]
    if any(farewell in message_lower for farewell in farewells):
        intent["is_farewell"] = True
    
    # Help request detection
    help_indicators = ["help", "need", "issue", "problem", "broken", "not working", "error"]
    if any(indicator in message_lower for indicator in help_indicators):
        intent["needs_help"] = True
        intent["wants_ticket"] = True
    
    # Multi-language ticket/agent request detection
    multilang_intent = detect_ticket_intent_multilang(message)
    if multilang_intent["needs_ticket"] or multilang_intent["needs_agent"]:
        intent["wants_ticket"] = True
        intent["needs_help"] = True
    
    # Information request
    info_indicators = ["what", "how", "when", "where", "why", "tell me", "explain", "information"]
    if any(indicator in message_lower for indicator in info_indicators):
        intent["wants_info"] = True
    
    # Solution request
    solution_indicators = ["fix", "solve", "resolve", "solution", "how to", "way to"]
    if any(indicator in message_lower for indicator in solution_indicators):
        intent["wants_solution"] = True
    
    # Status check
    status_indicators = ["status", "update", "check", "where is", "what happened"]
    if any(indicator in message_lower for indicator in status_indicators):
        intent["wants_status"] = True
    
    return intent


def should_create_ticket(message: str, conversation_history: List[Dict] = None, intent: Dict = None) -> bool:
    """
    Determine if a ticket should be created based on message and context.
    Supports all languages - always creates ticket if user explicitly asks for ticket or agent.
    """
    if intent is None:
        intent = analyze_user_intent(message, conversation_history)
    
    # Multi-language ticket/agent detection - ALWAYS create ticket if detected
    multilang_intent = detect_ticket_intent_multilang(message)
    if multilang_intent["should_route"]:
        return True
    
    # Don't create ticket for greetings or farewells alone
    if intent["is_greeting"] and not intent["needs_help"]:
        return False
    
    if intent["is_farewell"]:
        return False
    
    # Create ticket if user needs help or wants solution
    if intent["needs_help"] or intent["wants_solution"]:
        return True
    
    # Create ticket if user wants info but it's a complex query
    if intent["wants_info"] and len(message.split()) > 5:
        return True
    
    return False


def generate_contextual_response(
    message: str,
    conversation_history: List[Dict] = None,
    tone_analysis: Dict = None,
    intent: Dict = None
) -> str:
    """
    Generate a contextual, polite response based on user's tone and intent.
    """
    if tone_analysis is None:
        tone_analysis = analyze_tone(message, conversation_history)
    
    if intent is None:
        intent = analyze_user_intent(message, conversation_history)
    
    # Handle greetings
    if intent["is_greeting"]:
        if tone_analysis["is_polite"]:
            return "Hello! Thank you for reaching out. How can I assist you today?"
        else:
            return "Hello! How can I help you?"
    
    # Handle farewells
    if intent["is_farewell"]:
        return "You're welcome! If you need anything else, feel free to reach out. Have a great day!"
    
    # Generate tone-appropriate response
    base_response = generate_appropriate_response(tone_analysis, message)
    
    # Add context based on intent
    if intent["wants_info"]:
        base_response += " Let me provide you with that information."
    elif intent["wants_solution"]:
        base_response += " Let me help you find a solution."
    elif intent["wants_status"]:
        base_response += " Let me check the status for you."
    
    return base_response

