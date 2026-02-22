import os
from typing import Optional

from app.db.session import SessionLocal
from app.db.models.voice import VoiceProfile


def main() -> None:
    db = SessionLocal()
    try:
        profiles = (
            db.query(VoiceProfile)
            .order_by(VoiceProfile.id.desc())
            .limit(20)
            .all()
        )
        print(f"count={len(profiles)}")
        for p in profiles:
            print(
                f"id={p.id} name={p.name!r} provider={p.provider!r} provider_voice_id={p.provider_voice_id!r} "
                f"greeting_script_len={len((p.greeting_script or '').strip())} "
                f"greeting_audio_url={p.greeting_audio_url!r} sample_url={p.sample_url!r}"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()

