import re
from typing import Any, Dict, Union

# Regex patterns for common PII
EMAIL_REGEX = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
PHONE_REGEX = r'\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b'
CREDIT_CARD_REGEX = r'\b(?:\d{4}[-\s]?){3}\d{4}\b'
SSN_REGEX = r'\b\d{3}-\d{2}-\d{4}\b'

def redact_text(text: str) -> str:
    """
    Redact PII from a string using regex replacement.
    """
    if not isinstance(text, str):
        return text
        
    text = re.sub(EMAIL_REGEX, '[EMAIL_REDACTED]', text)
    text = re.sub(PHONE_REGEX, '[PHONE_REDACTED]', text)
    text = re.sub(CREDIT_CARD_REGEX, '[CC_REDACTED]', text)
    text = re.sub(SSN_REGEX, '[SSN_REDACTED]', text)
    return text

def redact_pii(data: Union[Dict[str, Any], str, list]) -> Union[Dict[str, Any], str, list]:
    """
    Recursively redact PII from a dictionary, list, or string.
    """
    if isinstance(data, str):
        return redact_text(data)
    
    if isinstance(data, list):
        return [redact_pii(item) for item in data]
    
    if isinstance(data, dict):
        new_dict = {}
        for key, value in data.items():
            # Skip redaction for specific keys if needed (e.g., internal IDs)
            if key in ["id", "user_id", "agent_id"]:
                new_dict[key] = value
            else:
                new_dict[key] = redact_pii(value)
        return new_dict
        
    return data
