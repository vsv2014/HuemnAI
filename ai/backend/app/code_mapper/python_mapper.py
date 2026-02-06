import ast
from typing import Dict, Any, List, Optional, Tuple


class SymbolVisitor(ast.NodeVisitor):
    def __init__(self):
        self.symbols: List[Dict[str, Any]] = []
    def visit_FunctionDef(self, node: ast.FunctionDef):
        self.symbols.append({"type": "function", "name": node.name, "lineno": node.lineno, "end": getattr(node, "end_lineno", node.lineno)})
        self.generic_visit(node)
    def visit_ClassDef(self, node: ast.ClassDef):
        self.symbols.append({"type": "class", "name": node.name, "lineno": node.lineno, "end": getattr(node, "end_lineno", node.lineno)})
        self.generic_visit(node)


def map_symbols(content: str) -> List[Dict[str, Any]]:
    tree = ast.parse(content)
    v = SymbolVisitor()
    v.visit(tree)
    return v.symbols


def resolve_code_refs(content: str, code_ref: Dict[str, Any]) -> Optional[Tuple[int, int]]:
    symbols = map_symbols(content)
    names = set(code_ref.get("symbols", []))
    for s in symbols:
        if s["name"] in names:
            return (s["lineno"], s["end"])
    return None
