
try:
    from TTS.api import TTS
    print("TTS imported successfully")
except Exception as e:
    print(f"TTS import failed: {e}")
