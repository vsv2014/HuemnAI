import json
from typing import Dict, Any, List


class FlowCompiler:
    def compile(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []
        # Prefer a designed_flow attached to plan.context
        ctx = (plan.get("context") or {})
        designed = ctx.get("designed_flow")
        if isinstance(designed, dict) and isinstance(designed.get("nodes"), list) and isinstance(designed.get("edges"), list):
            # Normalize positions if absent
            gx = 80
            gy = 120
            grid_x = gx
            grid_y = gy
            for i, n in enumerate(designed["nodes"]):
                nid = n.get("id") or f"n{i+1}"
                ntype = n.get("type") or "step"
                label = n.get("label") or nid
                x = n.get("x") if isinstance(n.get("x"), (int, float)) else grid_x
                y = n.get("y") if isinstance(n.get("y"), (int, float)) else grid_y
                nodes.append({"id": nid, "type": ntype, "label": label, "x": int(x), "y": int(y), "data": n.get("data") or {}})
                grid_x += 180
                grid_y += 60 if i % 2 == 0 else -40
            # Map edges
            for i, e in enumerate(designed["edges"]):
                src = e.get("source")
                dst = e.get("target")
                if src and dst:
                    edges.append({"id": f"e{i}", "source": src, "target": dst})
            # Ensure at least an entry and end are present
            have_entry = any(n for n in nodes if n["type"] == "entry" or n["id"] == "start")
            if not have_entry:
                nodes.insert(0, {"id": "start", "type": "entry", "label": "Start", "x": 80, "y": 120})
                edges.insert(0, {"id": f"e{len(edges)}", "source": "start", "target": nodes[1]["id"]})
            have_end = any(n for n in nodes if n["type"] == "end" or n["id"] == "end")
            if not have_end:
                last = nodes[-1]["id"]
                nodes.append({"id": "end", "type": "step", "label": "Complete", "x": nodes[-1]["x"] + 180, "y": nodes[-1]["y"] + 60})
                edges.append({"id": f"e{len(edges)}", "source": last, "target": "end"})
            # Apply layout only if positions are missing or forced
            has_positions = all(isinstance(n.get("x"), (int, float)) and isinstance(n.get("y"), (int, float)) for n in nodes)
            if not has_positions:
                return self._vertical_layout(nodes, edges)
            return {"nodes": nodes, "edges": edges}
        x = 80
        y = 120
        nodes.append({"id": "start", "type": "entry", "label": "Start", "x": x, "y": y})
        for i, s in enumerate(plan.get("steps", []), start=1):
            nid = s["id"]
            label = s["desc"]
            nodes.append({"id": nid, "type": "step", "label": label, "x": x, "y": y + i * 160})
        nodes.append({"id": "end", "type": "step", "label": "Complete", "x": x + 180, "y": y + 60})
        linear_ids = [n["id"] for n in nodes]
        for i in range(len(linear_ids) - 1):
            src = linear_ids[i]
            dst = linear_ids[i + 1]
            edges.append({"id": f"e{i}", "source": src, "target": dst})
        return self._vertical_layout(nodes, edges)

    def _vertical_layout(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> Dict[str, Any]:
        id_to_node = {n["id"]: n for n in nodes}
        indeg = {n["id"]: 0 for n in nodes}
        adj: Dict[str, List[str]] = {}
        for e in edges:
            adj.setdefault(e["source"], []).append(e["target"])
            indeg[e["target"]] = indeg.get(e["target"], 0) + 1
        start_id = None
        for n in nodes:
            if n["type"] == "entry" or n["id"] == "start":
                start_id = n["id"]
                break
        if start_id is None:
            start_id = next(iter(indeg.keys()))
        order: List[str] = []
        seen = set()
        q: List[str] = [start_id]
        while q:
            u = q.pop(0)
            if u in seen:
                continue
            seen.add(u)
            order.append(u)
            for v in adj.get(u, []):
                if v not in seen:
                    q.append(v)
        for nid in id_to_node.keys():
            if nid not in seen:
                order.append(nid)
        x0 = 240
        y0 = 100
        gap = 140
        for i, nid in enumerate(order):
            n = id_to_node.get(nid)
            if not n:
                continue
            n["x"] = x0
            n["y"] = y0 + i * gap
        return {"nodes": list(id_to_node.values()), "edges": edges}


class RuntimeEngine:
    def __init__(self):
        pass
    def run(self, compiled_flow: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        return {"flow": compiled_flow, "context": context}

    # Helpers
    def _vertical_layout(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> Dict[str, Any]:
        id_to_node = {n["id"]: n for n in nodes}
        indeg = {n["id"]: 0 for n in nodes}
        adj: Dict[str, List[str]] = {}
        for e in edges:
            adj.setdefault(e["source"], []).append(e["target"])
            indeg[e["target"]] = indeg.get(e["target"], 0) + 1
        # Determine start
        start_id = None
        for n in nodes:
            if n["type"] == "entry" or n["id"] == "start":
                start_id = n["id"]
                break
        if start_id is None:
            start_id = next(iter(indeg.keys()))
        # BFS order
        order: List[str] = []
        seen = set()
        q: List[str] = [start_id]
        while q:
            u = q.pop(0)
            if u in seen:
                continue
            seen.add(u)
            order.append(u)
            for v in adj.get(u, []):
                if v not in seen:
                    q.append(v)
        # Append remaining disconnected
        for nid in id_to_node.keys():
            if nid not in seen:
                order.append(nid)
        # Assign vertical positions
        x0 = 240
        y0 = 100
        gap = 140
        for i, nid in enumerate(order):
            n = id_to_node.get(nid)
            if not n:
                continue
            n["x"] = x0
            n["y"] = y0 + i * gap
        return {"nodes": list(id_to_node.values()), "edges": edges}
