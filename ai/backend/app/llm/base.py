from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Dict, Optional

class BaseLLM(ABC):
    @abstractmethod
    async def stream(self, message: str, messages: Optional[List[Dict[str, str]]] = None, model: Optional[str] = None) -> AsyncGenerator[str, None]:
        """
        Stream response from LLM.
        Args:
            message: The user message (fallback if messages is None)
            messages: Full conversation history [{"role": "user", "content": "..."}, ...]
            model: Specific model override
        """
        pass
