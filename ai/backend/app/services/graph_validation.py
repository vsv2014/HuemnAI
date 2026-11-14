"""Deterministic graph-lint rules independent of the inference provider.

This is graph inspection, not a full workflow compiler. It does not execute
nodes and deliberately treats cycles as warnings (some explicit loops are valid).
"""
from collections import deque
from typing import Iterable, Optional, Tuple


def validate_graph(
    node_ids: Iterable[int],
    edges: Iterable[Tuple[int, int]],
    entry_node_id: Optional[int],
) -> dict:
    nodes = set(node_ids)
    pairs = list(edges)
    errors = []
    warnings = []

    if not nodes:
        errors.append({"code": "empty_graph", "message": "Add at least one node."})
    if entry_node_id is None:
        errors.append({"code": "missing_entry", "message": "Select an entry node."})
    elif entry_node_id not in nodes:
        errors.append({"code": "invalid_entry", "message": "The entry node is not in this graph."})

    adjacency = {node: [] for node in nodes}
    for source, target in pairs:
        if source not in nodes or target not in nodes:
            errors.append({
                "code": "dangling_connection",
                "message": "Connection references a node outside this graph.",
                "source": source,
                "target": target,
            })
            continue
        adjacency[source].append(target)
        if source == target:
            warnings.append({
                "code": "self_loop",
                "message": "A node routes back to itself; verify loop termination.",
                "node": source,
            })

    if entry_node_id in nodes:
        visited = set()
        queue = deque([entry_node_id])
        while queue:
            node = queue.popleft()
            if node in visited:
                continue
            visited.add(node)
            queue.extend(next_id for next_id in adjacency[node] if next_id not in visited)

        for node in sorted(nodes - visited):
            warnings.append({
                "code": "unreachable_node",
                "message": "Node cannot be reached from the configured entry.",
                "node": node,
            })

        # DFS only over reachable nodes: nonreachable components are already flagged.
        gray, black = set(), set()
        cycles = set()

        def visit(node):
            gray.add(node)
            for target in adjacency[node]:
                if target in gray:
                    cycles.add(target)
                elif target not in black:
                    visit(target)
            gray.remove(node)
            black.add(node)

        # Explicit graph-size guard prevents unbounded recursion in the lint pass.
        if len(visited) <= 500:
            visit(entry_node_id)
            for node in sorted(cycles):
                warnings.append({
                    "code": "cycle",
                    "message": "Flow contains a cycle; check maximum step count and loop exit.",
                    "node": node,
                })
        else:
            warnings.append({
                "code": "too_large_for_cycle_lint",
                "message": "Cycle lint skipped for graphs with more than 500 reachable nodes.",
            })

    return {
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "node_count": len(nodes),
        "connection_count": len(pairs),
    }
