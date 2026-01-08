def rule_based_decision(message: str):
    emotion = detect_emotion(message)
    if emotion == "angry":
        return "I understand your frustration. Let me take ownership."
    return "Thanks for the details. Let me check this."

def should_create_ticket(message: str) -> bool:
    keywords = ["error", "issue", "failed", "not working"]
    return any(k in message.lower() for k in keywords)
