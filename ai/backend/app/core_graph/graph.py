import time
import json
from typing import Dict, Any, Optional, List
from app.services.socket_manager import manager


class UnifiedGraph:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.version = 0
        self.last_update = time.time()
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.edges: List[Dict[str, Any]] = []
        self.config: Dict[str, Any] = {}
        self.code_index: Dict[str, Dict[str, Any]] = {}  # file -> {symbols: [...]}
        self.runtime: Dict[str, Any] = {"state": {}, "status": "idle"}

    async def broadcast(self, event: str, data: Dict[str, Any]):
        await manager.send_json({"event": event, "data": data, "version": self.version}, client_id=self.session_id)

    async def set_nodes(self, nodes: List[Dict[str, Any]]):
        self.nodes = {n["id"]: n for n in nodes}
        self.version += 1
        self.last_update = time.time()
        await self.broadcast("graph_nodes", {"nodes": nodes})

    async def patch_node(self, node_id: str, patch: Dict[str, Any]):
        node = self.nodes.get(node_id, {"id": node_id})
        node.update(patch)
        self.nodes[node_id] = node
        self.version += 1
        await self.broadcast("graph_node_patch", {"id": node_id, "patch": patch})

    async def set_edges(self, edges: List[Dict[str, Any]]):
        self.edges = edges[:]
        self.version += 1
        await self.broadcast("graph_edges", {"edges": self.edges})

    async def patch_edge(self, edge: Dict[str, Any]):
        self.edges.append(edge)
        self.version += 1
        await self.broadcast("graph_edge_patch", {"edge": edge})

    async def set_code(self, file: str, content: str):
        self.code_index[file] = {"content": content}
        self.version += 1
        await self.broadcast("graph_code", {"file": file, "content": content})

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "version": self.version,
            "nodes": list(self.nodes.values()),
            "edges": self.edges,
            "config": self.config,
            "code_index": self.code_index,
            "runtime": self.runtime,
        }
