"""Summaries of a simulation over many worlds. All money as integer cents."""

from __future__ import annotations

import numpy as np

from engine.simulation.simulate import SimulationResult

_Z = 1.959963984540054
HORIZONS = (30, 60, 90)


def wilson(k: int, n: int) -> list[float]:
    """Wilson 95% interval for a proportion k/n."""
    if not n:
        return [0.0, 0.0]
    p = k / n
    d = 1 + _Z * _Z / n
    c = (p + _Z * _Z / (2 * n)) / d
    r = _Z * np.sqrt(p * (1 - p) / n + _Z * _Z / (4 * n * n)) / d
    return [float(c - r), float(c + r)]


def cents(x: float) -> int:
    return int(np.rint(x))


def summarize(r: SimulationResult) -> dict:
    hit = r.has_gap()
    n = len(hit)
    k = int(hit.sum())
    nodes = {str(x): int((r.first_node[hit] == x).sum()) for x in np.unique(r.first_node[hit])}
    # Every probability declares its event and horizon (architecture §6.3).
    by_horizon = {str(h): float(((r.first_day >= 0) & (r.first_day <= h)).mean()) for h in HORIZONS}
    return {
        "event": "uncovered_obligation",
        "paths": n,
        "gap_count": k,
        "gap_frequency": k / n,
        "gap_frequency_by_horizon": by_horizon,
        "ci95": wilson(k, n),
        "mean_gap_cents": cents(r.gap.mean()),
        "p95_gap_cents": cents(np.quantile(r.gap, 0.95)),
        "max_gap_cents": cents(r.gap.max()),
        "first_day_median_conditional": float(np.median(r.first_day[hit])) if k else None,
        "first_nodes": nodes,
    }
