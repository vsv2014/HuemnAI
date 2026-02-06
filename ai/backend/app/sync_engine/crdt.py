import time
from typing import Dict, Any, List


class VersionVector:
    def __init__(self):
        self.v: Dict[str, int] = {}
    def tick(self, client_id: str):
        self.v[client_id] = self.v.get(client_id, 0) + 1
    def merge(self, other: 'VersionVector'):
        for k, val in other.v.items():
            self.v[k] = max(self.v.get(k, 0), val)


class CRDTMerge:
    def __init__(self):
        self.vv = VersionVector()
    def lww_merge(self, base: Dict[str, Any], patch: Dict[str, Any], timestamp: float) -> Dict[str, Any]:
        for k, v in patch.items():
            if isinstance(v, dict) and isinstance(base.get(k), dict):
                base[k] = self.lww_merge(base[k], v, timestamp)
            else:
                base[k] = v
        return base
