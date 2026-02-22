
import sys
import os
import shutil

print(f"Python executable: {sys.executable}")

try:
    import imageio_ffmpeg
    print(f"imageio_ffmpeg found: {imageio_ffmpeg.__file__}")
    print(f"ffmpeg exe: {imageio_ffmpeg.get_ffmpeg_exe()}")
except ImportError:
    print("imageio_ffmpeg NOT found")

try:
    from TTS.api import TTS
    print(f"TTS found: {TTS}")
except ImportError as e:
    print(f"TTS NOT found: {e}")
except Exception as e:
    print(f"TTS error: {e}")

ffmpeg_path = shutil.which("ffmpeg")
print(f"shutil.which('ffmpeg'): {ffmpeg_path}")
