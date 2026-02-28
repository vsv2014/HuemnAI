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

    async def generate(
        self,
        message: str,
        messages: Optional[List[Dict[str, str]]] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        """
        Non-streaming generation helper.
        """
        tokens = []
        async for token in self.stream(message, messages, model, temperature, max_tokens):
            if not token.startswith("⚠️"):
                tokens.append(token)
        return "".join(tokens)
