import sys

import httpx


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python -m scripts.debug_fetch_url <url>")
        return 2
    url = sys.argv[1]
    r = httpx.get(url, timeout=120.0)
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

