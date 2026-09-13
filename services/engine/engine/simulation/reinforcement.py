"""Minimum reinforcement: the smallest change on a one-step grid that keeps the
Wilson upper bound of the gap frequency at or below the tolerance.

The search runs on the `search` worlds; the caller verifies the chosen value on
independent worlds. The grid is exhaustive, in ascending order, and stops at the
first value that satisfies the condition — the report's protocol.
"""

from __future__ import annotations

from collections.abc import Callable

from engine.simulation.simulate import SimulationResult
from engine.simulation.summary import summarize


def search_minimum_reinforcement(
    run: Callable[[float], SimulationResult],
    grid: list[float],
    tolerance: float = 0.05,
) -> tuple[float | None, list[dict]]:
    """Returns (chosen value or None, evaluated grid)."""
    evaluated: list[dict] = []
    chosen: float | None = None
    for value in grid:
        s = summarize(run(value))
        evaluated.append(
            {"value": value, "gap_frequency": s["gap_frequency"], "upper95": s["ci95"][1]}
        )
        if s["ci95"][1] <= tolerance:
            chosen = value
            break
    return chosen, evaluated
