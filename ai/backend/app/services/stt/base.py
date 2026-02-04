from abc import ABC, abstractmethod
from typing import BinaryIO, Optional

class BaseSTT(ABC):
    @abstractmethod
    async def transcribe(self, audio_file: BinaryIO, language: Optional[str] = None) -> str:
        """
        Transcribe audio file to text.
        Args:
            audio_file: Binary file-like object containing audio data
            language: Optional language code (e.g. "en")
        Returns:
            Transcribed text
        """
        pass
