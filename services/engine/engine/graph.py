"""The universal SME graph reduced to constants for the MVP.

Six stacks, one node registered once, and the business-rule edges that the demo
implements. `path_to` returns the propagation path rendered by Module D. The
graph attributes no causality: it is documented rules, marked as implemented or
not, exactly as the evaluation report requires.
"""

from __future__ import annotations

STACKS: dict[str, list[str]] = {
    "finance": ["cash", "reserve", "debt", "credit"],
    "sales": ["sales", "customer", "invoice", "collection"],
    "operations": ["delivery", "materials", "capacity", "supplier"],
    "people": ["payroll", "staff", "hiring", "critical_person"],
    "technology": ["billing_system", "infrastructure", "backups", "tech_provider"],
    "compliance": ["tax", "license", "insurance", "regulation"],
}

NODE_STACK: dict[str, str] = {n: s for s, nodes in STACKS.items() for n in nodes}

# (source, target, mechanism, implemented_in_demo)
_EDGES: list[tuple[str, str, str, bool]] = [
    ("materials", "delivery", "enables delivery", False),
    ("delivery", "invoice", "invoicing on delivery", True),
    ("invoice", "collection", "collection after contractual term", True),
    ("collection", "cash", "cash receipt", True),
    ("customer", "sales", "main customer concentrates sales", True),
    ("sales", "cash", "base operating receipts", True),
    ("materials", "cash", "purchase outflow", True),
    ("hiring", "cash", "project staff cost", True),
    ("credit", "cash", "financing inflow", True),
    ("debt", "cash", "debt service", True),
    ("cash", "payroll", "funds the payroll obligation", True),
    ("cash", "supplier", "funds supplier payments", True),
    ("cash", "debt", "funds debt service", True),
    ("billing_system", "invoice", "allows issuing the invoice", False),
    ("cash", "tax", "funds taxes", False),
]

GRAPH = {
    "nodes": [{"id": n, "stack": s} for s, nodes in STACKS.items() for n in nodes],
    "edges": [
        {
            "source": a,
            "target": b,
            "mechanism": m,
            "source_type": "business_rule",
            "implemented_in_demo": active,
        }
        for a, b, m, active in _EDGES
    ],
}


def path_to(target: str, start: str = "delivery") -> list[str]:
    """Shortest path over implemented edges, breadth first. Empty if unreachable."""
    queue: list[tuple[str, list[str]]] = [(start, [start])]
    seen: set[str] = set()
    while queue:
        node, path = queue.pop(0)
        if node == target:
            return path
        if node in seen:
            continue
        seen.add(node)
        for e in GRAPH["edges"]:
            if e["source"] == node and e["implemented_in_demo"]:
                queue.append((e["target"], path + [e["target"]]))
    return []
