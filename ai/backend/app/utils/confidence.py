def calculate_confidence(
    emotion: str,
    rule_confidence: float = 0.7,
    llm_used: bool = False
) -> float:
    """
    Calculate response confidence score (0–1)
    Used for analytics + UI indicators
    """

    base = rule_confidence

    if emotion == "angry":
        base += 0.1

    if llm_used:
        base += 0.15

    # Cap between 0 and 1
    return round(min(base, 1.0), 2)
