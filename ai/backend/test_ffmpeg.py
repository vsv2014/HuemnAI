import imageio_ffmpeg
import os
try:
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"FFmpeg path: {exe}")
    print(f"Exists: {os.path.exists(exe)}")
except Exception as e:
    print(f"Error: {e}")
