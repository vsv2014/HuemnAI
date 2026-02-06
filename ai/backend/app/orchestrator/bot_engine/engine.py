import json
from typing import Dict, Any, List


class FlowCompiler:
    def compile(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []
        x = 80
        y = 120
        nodes.append({"id": "start", "type": "entry", "label": "Start", "x": x, "y": y})
        for i, s in enumerate(plan.get("steps", []), start=1):
            x += 180
            y += 60 if i % 2 == 0 else -40
            nid = s["id"]
            label = s["desc"]
            nodes.append({"id": nid, "type": "step", "label": label, "x": x, "y": y})
        # Heuristic feature branches from prompt
        raw = (plan.get("context", {}) or {}).get("raw", "") or ""
        text = raw.lower()
        features = []
        if any(k in text for k in ["account", "balance", "statement", "kyc"]):
            features.append(("account", "Account Services"))
        if any(k in text for k in ["card", "pin", "block", "fraud"]):
            features.append(("cards", "Card Services"))
        if any(k in text for k in ["payment", "transfer", "upi", "neft", "imps", "rtgs", "refund"]):
            features.append(("payments", "Payments & Transfers"))
        if any(k in text for k in ["loan", "emi", "prepayment", "eligibility", "credit"]):
            features.append(("loans", "Loans & Credit"))
        if any(k in text for k in ["login", "digital", "app", "password", "feature"]):
            features.append(("digital", "Digital Banking"))
        if any(k in text for k in ["complaint", "dispute", "escalation", "resolve"]):
            features.append(("complaints", "Complaints & Disputes"))
        if features:
            intent_x = x + 180
            intent_y = y + 60
            nodes.append({"id": "intent", "type": "decision", "label": "Intent Classification", "x": intent_x, "y": intent_y})
            edges.append({"id": f"e{len(edges)}", "source": nodes[-2]["id"], "target": "intent"})
            bx = intent_x + 180
            by = intent_y - 120
            for i, (fid, flabel) in enumerate(features):
                nodes.append({"id": fid, "type": "step", "label": flabel, "x": bx, "y": by + i * 150})
                edges.append({"id": f"e{len(edges)}", "source": "intent", "target": fid})
            x = bx + 180
            y = intent_y + 60
        nodes.append({"id": "end", "type": "step", "label": "Complete", "x": x + 180, "y": y + 60})
        linear_ids = [n["id"] for n in nodes if n["id"] not in {"intent"}]
        for i in range(len(linear_ids) - 1):
            src = linear_ids[i]
            dst = linear_ids[i + 1]
            if not any(e for e in edges if e["source"] == src and e["target"] == dst):
                edges.append({"id": f"e{len(edges)}", "source": src, "target": dst})
        return {"nodes": nodes, "edges": edges}


class RuntimeEngine:
    def __init__(self):
        pass
    def run(self, compiled_flow: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        return {"flow": compiled_flow, "context": context}
