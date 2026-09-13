"""Vectorised cash simulation of a calendar over a set of worlds.

For every world the calendar is walked day by day from the cut-off to the
horizon. Within a day receipts are applied before commitments, then by priority.
A movement whose effective day falls beyond the horizon is censored: a receipt
that arrives after day 180 never helps, exactly as in the original engine.

Amounts are float64 cents inside; the result exposes integer cents.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from engine.cash.movements import CENT_TOLERANCE, Movement, normalize
from engine.errors import DataQualityError
from engine.simulation.worlds import World


@dataclass(frozen=True)
class SimulationResult:
    gap: np.ndarray  # maximum shortfall per world, cents (>= 0)
    first_day: np.ndarray  # day of the first uncovered obligation, -1 if none
    first_node: np.ndarray  # node of the first uncovered obligation
    first_gap: np.ndarray  # shortfall at the first uncovered obligation, cents
    ending_cash: np.ndarray
    inflow: np.ndarray
    outflow: np.ndarray
    node_min_cash: dict[str, np.ndarray]  # minimum cash right after each node's payments
    effective_days: dict[str, np.ndarray]  # effective day per shifted movement id
    history: np.ndarray | None = None  # (horizon+1, n) cash path when traced

    @property
    def n(self) -> int:
        return len(self.gap)

    def has_gap(self) -> np.ndarray:
        return self.gap > CENT_TOLERANCE


def simulate(
    world: World,
    movements: list[Movement],
    opening_cents: int,
    horizon: int = 180,
    collection_delay_days: int = 0,
    trace: bool = False,
) -> SimulationResult:
    if opening_cents is None or not isinstance(opening_cents, int) or opening_cents < 0:
        raise DataQualityError("opening balance unknown or invalid")
    if horizon < 1:
        raise DataQualityError("horizon must be at least one day")
    clean, _ = normalize(movements)
    n = world.n
    cash = np.full(n, float(opening_cents))
    mincash = cash.copy()
    first_day = np.full(n, -1)
    first_node = np.full(n, "", dtype="<U24")
    first_gap = np.zeros(n)
    inflow = np.zeros(n)
    outflow = np.zeros(n)
    node_min: dict[str, np.ndarray] = {}
    effective_days: dict[str, np.ndarray] = {}

    # Schedule: movements with a world-independent day are grouped by day; shifted
    # movements carry a per-world effective day and are checked on their day range.
    fixed: dict[int, list[tuple[Movement, np.ndarray | float]]] = {}
    shifted: list[tuple[Movement, np.ndarray, np.ndarray | float, int, int]] = []
    for m in clean:
        amount: np.ndarray | float = float(m.amount_cents)
        if m.scale == "sales":
            amount = m.amount_cents * world.sales_factor
        elif m.scale == "cost":
            amount = m.amount_cents * world.cost_factor
        if m.shift == "none":
            fixed.setdefault(m.day, []).append((m, amount))
            continue
        eff = np.full(n, m.day) + world.delivery_delay
        if m.shift == "collection":
            eff = eff + world.collection_delay + collection_delay_days
        effective_days[m.id] = eff
        if n == 1:
            fixed.setdefault(int(eff[0]), []).append((m, amount))
        else:
            shifted.append((m, eff, amount, int(eff.min()), int(eff.max())))

    history = [] if trace else None
    for day in range(horizon + 1):
        active: list[tuple[Movement, np.ndarray | float]] = list(fixed.get(day, []))
        for m, eff, amount, lo, hi in shifted:
            if lo <= day <= hi:
                mask = eff == day
                if mask.any():
                    active.append((m, np.where(mask, amount, 0.0)))
        if active:
            active.sort(key=lambda item: item[0].sort_key())
            for m, amount in active:
                if m.direction == "in":
                    cash = cash + amount
                    inflow = inflow + amount
                else:
                    cash = cash - amount
                    outflow = outflow + amount
                    hit = (cash < -CENT_TOLERANCE) & (first_day < 0)
                    if hit.any():
                        first_day = np.where(hit, day, first_day)
                        first_node = np.where(hit, m.node, first_node)
                        first_gap = np.where(hit, -cash, first_gap)
                    current = node_min.get(m.node)
                    node_min[m.node] = cash.copy() if current is None else np.minimum(current, cash)
                mincash = np.minimum(mincash, cash)
        if history is not None:
            history.append(cash.copy())

    return SimulationResult(
        gap=np.maximum(0.0, -mincash),
        first_day=first_day,
        first_node=first_node,
        first_gap=first_gap,
        ending_cash=cash,
        inflow=inflow,
        outflow=outflow,
        node_min_cash=node_min,
        effective_days=effective_days,
        history=np.array(history) if history is not None else None,
    )
