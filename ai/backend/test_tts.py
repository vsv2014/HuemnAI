import os
import time

try:
    print("Importing TTS...")
    start = time.time()
    from TTS.api import TTS
    print(f"TTS imported in {time.time() - start:.2f}s")
    
    model_path = os.getenv("LOCAL_TTS_MODEL", "tts_models/multilingual/multi-dataset/your_tts")
    print(f"Loading model: {model_path}")
    
    start = time.time()
    try:
        if os.path.exists(model_path):
            tts = TTS(model_path=model_path, progress_bar=False, gpu=False)
        else:
            tts = TTS(model_name=model_path, progress_bar=False, gpu=False)
        print(f"Model loaded in {time.time() - start:.2f}s")
    except Exception as e:
        print(f"Failed to load model: {e}")

except ImportError:
    print("TTS not installed")
except Exception as e:
    print(f"Error: {e}")
