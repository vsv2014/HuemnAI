import sys
from typing import Optional

import httpx


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: python -m scripts.debug_fetch_twilio_speak <voice_id> <text>")
        return 2

    voice_id = sys.argv[1]
    text = " ".join(sys.argv[2:])

    url = "http://localhost:8001/api/voice/twilio-speak"
    params = {"voice_id": voice_id, "text": text}
    r = httpx.get(url, params=params, timeout=120.0)
    print("status", r.status_code)
    print("content-type", r.headers.get("content-type"))
    data = r.content
    print("len", len(data))
    print("head", data[:16])
    if r.status_code >= 400:
        try:
            print("body", r.json())
        except Exception:
            print("body", data[:2000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

