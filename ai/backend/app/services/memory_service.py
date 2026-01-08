MEMORY = {}

def save(user_id: str, text: str):
    MEMORY.setdefault(user_id, []).append(text)

def fetch(user_id: str):
    return MEMORY.get(user_id, [])
