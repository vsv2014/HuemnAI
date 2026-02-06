from fastapi import APIRouter, WebSocket, HTTPException, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from app.services.socket_manager import manager
from app.orchestrator.memory.store import MemoryStore
from app.core_graph.graph import UnifiedGraph
from app.code_mapper.python_mapper import resolve_code_refs
import ast
import json

router = APIRouter()

_graphs: Dict[str, UnifiedGraph] = {}


class NodePatch(BaseModel):
    session_id: str
    id: str
    patch: Dict[str, Any]
    client_id: str

class CodeUpdate(BaseModel):
    session_id: str
    file: str
    content: str
    client_id: str

class ResolveRequest(BaseModel):
    session_id: str
    file: str
    code_ref: Dict[str, Any]

class ResolveResponse(BaseModel):
    range: Optional[Dict[str, int]] = None


@router.websocket("/sync/{session_id}")
async def sync_ws(ws: WebSocket, session_id: str):
    await manager.connect(ws, client_id=session_id)
    try:
        if session_id not in _graphs:
            _graphs[session_id] = UnifiedGraph(session_id)
        g = _graphs[session_id]
        # Send current snapshot on connect so client doesn't miss early broadcasts
        try:
            await ws.send_json({"event": "graph_nodes", "data": {"nodes": list(g.nodes.values())}, "version": g.version})
            await ws.send_json({"event": "graph_edges", "data": {"edges": g.edges}, "version": g.version})
            for file, idx in g.code_index.items():
                await ws.send_json({"event": "graph_code", "data": {"file": file, "content": idx.get("content", "")}, "version": g.version})
        except Exception:
            pass
        while True:
            try:
                await ws.receive_text()
            except WebSocketDisconnect:
                break
            except Exception:
                # Ignore malformed pings and continue
                continue
    except Exception:
        manager.disconnect(ws, client_id=session_id)


@router.post("/node-patch")
async def node_patch(req: NodePatch):
    g = _graphs.get(req.session_id)
    if not g:
        _graphs[req.session_id] = UnifiedGraph(req.session_id)
        g = _graphs[req.session_id]
    await g.patch_node(req.id, req.patch)
    await MemoryStore.save_session(req.session_id, g.to_dict())
    return {"ok": True}


@router.post("/code-update")
async def code_update(req: CodeUpdate):
    g = _graphs.get(req.session_id)
    if not g:
        _graphs[req.session_id] = UnifiedGraph(req.session_id)
        g = _graphs[req.session_id]
    if req.file.endswith(".py"):
        try:
            ast.parse(req.content)
        except SyntaxError as e:
            raise HTTPException(status_code=400, detail=f"Syntax error: {e}")
    await g.set_code(req.file, req.content)
    await MemoryStore.save_session(req.session_id, g.to_dict())
    return {"ok": True}


@router.post("/resolve", response_model=ResolveResponse)
async def resolve(req: ResolveRequest):
    g = _graphs.get(req.session_id)
    if not g:
        raise HTTPException(status_code=404, detail="Session not found")
    content = g.code_index.get(req.file, {}).get("content", "")
    r = resolve_code_refs(content, req.code_ref)
    if r:
        return {"range": {"start": r[0], "end": r[1]}}
    return {"range": None}

@router.get("/llm/status")
async def llm_status():
    try:
        from app.services.config_service import get_llm_config
        cfg = get_llm_config()
        configured = bool(cfg and cfg.get("api_key"))
        source = "database" if (cfg and cfg.get("is_database")) else ("env" if cfg else "none")
        provider = (cfg or {}).get("provider")
        return {"configured": configured, "provider": provider, "source": source}
    except Exception:
        return {"configured": False, "provider": None, "source": "none"}
