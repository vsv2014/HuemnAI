import os

from app.services.huemn_voice_service import LOCAL_TTS_MODEL


def main() -> None:
    path = LOCAL_TTS_MODEL
    print("LOCAL_TTS_MODEL:", path)
    print("exists:", os.path.exists(path))
    print("is_file:", os.path.isfile(path))
    print("is_dir:", os.path.isdir(path))
    if os.path.isdir(path):
        items = sorted(os.listdir(path))
        print("dir_items_count:", len(items))
        print("dir_items_head:", items[:20])


if __name__ == "__main__":
    main()

