import sys
import os
import asyncio

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.llm.registry import get_llm
from app.services.stt.openai_stt import OpenAISTT

async def test_imports():
    print("Testing LLM Registry...")
    try:
        claude = get_llm("claude")
        print(f"Claude LLM instance: {claude}")
        gemini = get_llm("gemini")
        print(f"Gemini LLM instance: {gemini}")
    except Exception as e:
        print(f"LLM Registry Error: {e}")

    print("Testing STT Service...")
    try:
        stt = OpenAISTT()
        print(f"STT instance: {stt}")
    except Exception as e:
        print(f"STT Service Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_imports())
