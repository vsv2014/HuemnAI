from typing import Dict, Literal
import re

# Tone types
ToneType = Literal["polite", "frustrated", "urgent", "neutral", "angry", "confused", "happy"]

def analyze_tone(message: str, conversation_history: list = None) -> Dict:
    """
    Analyze the tone and emotional state of the user's message.
    Returns tone type, urgency level, and politeness indicators.
    """
    message_lower = message.lower()
    
    # Initialize tone analysis
    tone_scores = {
        "polite": 0,
        "frustrated": 0,
        "urgent": 0,
        "neutral": 0,
        "angry": 0,
        "confused": 0,
        "happy": 0
    }
    
    # Politeness indicators
    polite_words = ["please", "thank you", "thanks", "appreciate", "kindly", "would you", "could you", "may i"]
    for word in polite_words:
        if word in message_lower:
            tone_scores["polite"] += 2
    
    # Frustration indicators
    frustrated_words = ["frustrated", "annoying", "not working", "broken", "issue", "problem", "error", "failed"]
    for word in frustrated_words:
        if word in message_lower:
            tone_scores["frustrated"] += 1
    
    # Urgency indicators
    urgent_words = ["urgent", "asap", "immediately", "now", "emergency", "critical", "important", "quickly"]
    urgent_patterns = ["need help", "can't", "won't", "doesn't work"]
    for word in urgent_words:
        if word in message_lower:
            tone_scores["urgent"] += 2
    
    for pattern in urgent_patterns:
        if pattern in message_lower:
            tone_scores["urgent"] += 1
    
    # Anger indicators
    angry_words = ["terrible", "awful", "horrible", "worst", "hate", "disgusted", "ridiculous"]
    angry_patterns = ["!", "!!!", "???"]
    for word in angry_words:
        if word in message_lower:
            tone_scores["angry"] += 2
    
    # Count exclamation marks (indicates strong emotion)
    exclamation_count = message.count("!")
    if exclamation_count >= 3:
        tone_scores["angry"] += 2
        tone_scores["urgent"] += 1
    elif exclamation_count >= 1:
        tone_scores["urgent"] += 1
    
    # Confusion indicators
    confused_words = ["don't understand", "confused", "what", "how", "why", "?", "??"]
    question_count = message.count("?")
    for word in confused_words:
        if word in message_lower:
            tone_scores["confused"] += 1
    if question_count >= 2:
        tone_scores["confused"] += 1
    
    # Happy/positive indicators
    happy_words = ["great", "thanks", "thank you", "appreciate", "good", "excellent", "perfect"]
    for word in happy_words:
        if word in message_lower:
            tone_scores["happy"] += 1
    
    # Determine primary tone
    primary_tone = max(tone_scores.items(), key=lambda x: x[1])[0]
    
    # If no strong indicators, default to neutral
    if tone_scores[primary_tone] == 0:
        primary_tone = "neutral"
    
    # Calculate urgency level (0-5)
    urgency = min(5, tone_scores["urgent"] + tone_scores["angry"])
    
    # Determine if user is polite
    is_polite = tone_scores["polite"] > 0 or primary_tone == "polite"
    
    return {
        "tone": primary_tone,
        "urgency": urgency,
        "is_polite": is_polite,
        "scores": tone_scores,
        "requires_empathy": primary_tone in ["frustrated", "angry", "confused"],
        "requires_urgency": urgency >= 3
    }


def generate_appropriate_response(tone_analysis: Dict, message: str, context: str = "") -> str:
    """
    Generate an appropriate response based on tone analysis.
    """
    tone = tone_analysis["tone"]
    urgency = tone_analysis["urgency"]
    is_polite = tone_analysis["is_polite"]
    requires_empathy = tone_analysis["requires_empathy"]
    
    # Base response templates based on tone
    responses = {
        "polite": [
            "Thank you for reaching out! I'm here to help you.",
            "I appreciate you contacting us. Let me assist you with that.",
            "Thank you for your patience. I'll help resolve this for you."
        ],
        "frustrated": [
            "I understand this is frustrating. Let me help you resolve this quickly.",
            "I can see this has been bothering you. I'm here to help fix this.",
            "I understand your frustration. Let's get this sorted out right away."
        ],
        "urgent": [
            "I understand this is urgent. Let me prioritize this for you immediately.",
            "I can see this needs immediate attention. I'm on it right away.",
            "This sounds urgent. Let me help you resolve this as quickly as possible."
        ],
        "angry": [
            "I sincerely apologize for the inconvenience. Let me help resolve this immediately.",
            "I understand your frustration, and I'm sorry you're experiencing this. Let me fix this right away.",
            "I apologize for the trouble. I'm prioritizing this to get it resolved quickly."
        ],
        "confused": [
            "No worries at all! Let me help clarify this for you.",
            "I'm happy to help explain this. Let me break it down for you.",
            "That's a great question! Let me help you understand this better."
        ],
        "happy": [
            "Great to hear! I'm glad I could help.",
            "Wonderful! I'm happy to assist you further if needed.",
            "Excellent! Let me know if there's anything else I can help with."
        ],
        "neutral": [
            "I'm here to help. Let me assist you with that.",
            "I understand. Let me help you with this.",
            "I can help with that. Let me get started."
        ]
    }
    
    # Select appropriate response
    import random
    base_response = random.choice(responses.get(tone, responses["neutral"]))
    
    # Add urgency acknowledgment if needed
    if urgency >= 3:
        base_response = f"I understand this is urgent. {base_response}"
    
    # Match user's politeness level
    if is_polite:
        base_response = base_response.replace("I'm", "I'm").replace("Let me", "Please allow me to")
    
    return base_response


def determine_priority_from_tone(tone_analysis: Dict) -> str:
    """
    Determine ticket priority based on user's tone.
    """
    urgency = tone_analysis["urgency"]
    tone = tone_analysis["tone"]
    
    if urgency >= 4 or tone == "angry":
        return "urgent"
    elif urgency >= 2 or tone in ["frustrated", "urgent"]:
        return "high"
    elif tone == "confused":
        return "medium"
    else:
        return "medium"
