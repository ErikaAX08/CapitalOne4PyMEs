"""Tension = 1 − (available margin ÷ reference range), clamped to [0, 1].

A normalisation of univariate tolerances, not a learned causal attribution. Each
factor travels with its margin and its range so the figure is auditable. The two
reference ranges marked as declared assumptions in the PRD are flagged here too.

The sweeps hold everything else at nominal: no random shock, the other stress
controls at their neutral value. The delay sweep is exhaustive over the integer
grid and does not presuppose monotonicity.
"""

from __future__ import annotations

from collections.abc import Callable

from engine.cash.movements import CENT_TOLERANCE
from engine.simulation.simulate import SimulationResult
from engine.simulation.worlds import World, deterministic

DELAY_SEARCH_MAX_DAYS = 120
SALES_SEARCH_MAX_PP = 100
COST_SEARCH_MAX_PP = 200

# Reference ranges. Sources: PRD §3.3.
COLLECTION_DELAY_RANGE_DAYS = 60  # control range of the stress slider
COST_INCREASE_RANGE_PP = 20.0  # declared assumption
SALES_DROP_RANGE_PP = 20.0  # declared assumption

Runner = Callable[[World], SimulationResult]


def _first(r: SimulationResult) -> dict | None:
    if r.gap[0] <= CENT_TOLERANCE:
        return None
    return {
        "first_day": int(r.first_day[0]),
        "first_node": str(r.first_node[0]),
        "gap_cents": int(round(float(r.first_gap[0]))),
        "max_gap_cents": int(round(float(r.gap[0]))),
    }


def breaking_points(run: Runner) -> dict:
    """Smallest univariate perturbation that opens a gap, per axis."""
    out: dict = {}
    delay = next(
        (
            (d, _first(run(deterministic(delay=d))))
            for d in range(DELAY_SEARCH_MAX_DAYS + 1)
            if _first(run(deterministic(delay=d)))
        ),
        None,
    )
    out["collection_delay"] = (
        {"additional_days": delay[0], **delay[1], "bounded": False}
        if delay
        else {"additional_days": None, "search_max_days": DELAY_SEARCH_MAX_DAYS, "bounded": True}
    )
    sales = next(
        (
            (p, _first(run(deterministic(sales=1 - p / 100))))
            for p in range(SALES_SEARCH_MAX_PP + 1)
            if _first(run(deterministic(sales=1 - p / 100)))
        ),
        None,
    )
    out["sales_drop"] = (
        {"drop_pp": float(sales[0]), **sales[1], "bounded": False}
        if sales
        else {"drop_pp": None, "search_max_pp": SALES_SEARCH_MAX_PP, "bounded": True}
    )
    cost = next(
        (
            (p, _first(run(deterministic(cost=1 + p / 100))))
            for p in range(COST_SEARCH_MAX_PP + 1)
            if _first(run(deterministic(cost=1 + p / 100)))
        ),
        None,
    )
    out["cost_increase"] = (
        {"increase_pp": float(cost[0]), **cost[1], "bounded": False}
        if cost
        else {"increase_pp": None, "search_max_pp": COST_SEARCH_MAX_PP, "bounded": True}
    )
    return out


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def tension_factors(
    path: SimulationResult,
    points: dict,
    payroll_cents: int,
    contracted_term_days: int,
    average_collection_days: int,
    concentration: float,
) -> list[dict]:
    """The six factors of PRD §3.3, sorted by descending tension."""
    payroll_min = path.node_min_cash.get("payroll")
    payroll_margin = int(round(float(payroll_min[0]))) if payroll_min is not None else payroll_cents
    delay = points["collection_delay"]
    delay_margin = delay["additional_days"] if not delay["bounded"] else delay["search_max_days"]
    cost = points["cost_increase"]
    cost_margin = cost["increase_pp"] if not cost["bounded"] else float(cost["search_max_pp"])
    sales = points["sales_drop"]
    sales_margin = sales["drop_pp"] if not sales["bounded"] else float(sales["search_max_pp"])
    collection_margin = contracted_term_days - average_collection_days

    factors = [
        {
            "factor": "payroll_coverage",
            "stack": "people",
            "margin_cents": payroll_margin,
            "range_cents": payroll_cents,
            "tension": _clamp(1 - payroll_margin / payroll_cents),
            "range_source": "documented",
        },
        {
            "factor": "average_collection_period",
            "stack": "finance",
            "margin_days": collection_margin,
            "range_days": contracted_term_days,
            "tension": _clamp(1 - collection_margin / contracted_term_days),
            "range_source": "documented",
        },
        {
            "factor": "collection_delay_tolerance",
            "stack": "sales",
            "margin_days": delay_margin,
            "range_days": COLLECTION_DELAY_RANGE_DAYS,
            "tension": _clamp(1 - delay_margin / COLLECTION_DELAY_RANGE_DAYS),
            "range_source": "control_range",
            "search_bounded": delay["bounded"],
        },
        {
            "factor": "cost_increase_tolerance",
            "stack": "operations",
            "margin_pp": cost_margin,
            "range_pp": COST_INCREASE_RANGE_PP,
            "tension": _clamp(1 - cost_margin / COST_INCREASE_RANGE_PP),
            "range_source": "declared_assumption",
            "search_bounded": cost["bounded"],
        },
        {
            "factor": "sales_drop_tolerance",
            "stack": "sales",
            "margin_pp": sales_margin,
            "range_pp": SALES_DROP_RANGE_PP,
            "tension": _clamp(1 - sales_margin / SALES_DROP_RANGE_PP),
            "range_source": "declared_assumption",
            "search_bounded": sales["bounded"],
        },
        {
            "factor": "main_customer_concentration",
            "stack": "sales",
            "margin": round(1 - concentration, 4),
            "range": 1.0,
            "tension": _clamp(concentration),
            "range_source": "documented",
        },
    ]
    for f in factors:
        f["tension"] = round(f["tension"], 2)
    return sorted(factors, key=lambda f: -f["tension"])
