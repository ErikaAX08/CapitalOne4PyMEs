"""Orchestration: an engine request becomes an engine result.

The request is the payload the Go domain sends on `lambda:Invoke`
(`contracts/engine-request.schema.json`). The result is English, integer cents,
and carries every intermediate figure the projector needs. No Spanish copy is
produced here.

Steps, in the order the architecture describes:
1. cash · build the base calendar, apply the action, apply the stress controls;
2. cash · deterministic path → first uncovered obligation, weeks of survival;
3. simulation · Monte Carlo over the verification worlds;
4. simulation · one-step grid on the search worlds → minimum reinforcement,
   verified on the same verification worlds as the unreinforced case;
5. tension · univariate sweeps → six factors.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np

from engine import ENGINE_VERSION
from engine.actions import Action
from engine.cash.movements import CENT_TOLERANCE, Movement
from engine.cash.profile import CompanyProfile, base_calendar
from engine.graph import path_to
from engine.simulation import (
    deterministic,
    search_minimum_reinforcement,
    simulate,
    summarize,
    worlds,
)
from engine.simulation.simulate import SimulationResult
from engine.stress import Stress
from engine.tension import breaking_points, tension_factors

DEFAULT_HORIZON_DAYS = 180
DEFAULT_PATHS = 5000
MIN_PATHS, MAX_PATHS = 100, 20000
REINFORCEMENT_TOLERANCE = 0.05
ABSTENTION_UNKNOWN_FRACTION = 0.20
# Capital injection grid: 1% steps of the PRD slider ceiling ($400,000 MXN).
INJECTION_CEILING_CENTS = 40_000_000
CRISIS_WEEKS = 4


@dataclass(frozen=True)
class EngineRequest:
    profile: CompanyProfile
    action: Action
    stress: Stress = field(default_factory=Stress)
    paths: int = DEFAULT_PATHS
    seed: int = 42
    horizon_days: int = DEFAULT_HORIZON_DAYS

    @staticmethod
    def from_dict(data: dict[str, Any]) -> EngineRequest:
        action = data.get("action") or {"kind": "none", "parameters": {}}
        stress = data.get("stress") or {}
        return EngineRequest(
            profile=CompanyProfile.from_dict(data["company"]),
            action=Action(action["kind"], dict(action.get("parameters") or {})),
            stress=Stress(
                int(stress.get("collection_delay_days", 0)),
                bool(stress.get("main_customer_lost", False)),
                int(stress.get("capital_injection_cents", 0)),
            ),
            paths=int(data.get("paths", DEFAULT_PATHS)),
            seed=int(data.get("seed", 42)),
            horizon_days=int(data.get("horizon_days", DEFAULT_HORIZON_DAYS)),
        )


class Scenario:
    """A parameterization bound to a profile: builds calendars and runs simulations."""

    def __init__(self, profile: CompanyProfile, action: Action, stress: Stress, horizon: int):
        self.profile, self.action, self.stress, self.horizon = profile, action, stress, horizon
        self.base = base_calendar(profile, horizon)

    def calendar(
        self, action: Action | None = None, stress: Stress | None = None
    ) -> list[Movement]:
        action = self.action if action is None else action
        stress = self.stress if stress is None else stress
        return stress.apply(self.base + action.movements(self.profile, self.horizon), self.profile)

    def run(
        self, world, action: Action | None = None, stress: Stress | None = None, trace: bool = False
    ) -> SimulationResult:
        stress = self.stress if stress is None else stress
        assert self.profile.opening_balance_cents is not None
        return simulate(
            world,
            self.calendar(action, stress),
            self.profile.opening_balance_cents,
            self.horizon,
            stress.collection_delay_days,
            trace,
        )


def recurring_net_flow(profile: CompanyProfile, stress: Stress) -> int:
    """Net recurring cash flow per 30 days of the current operation, cents.

    Negative means the business bleeds cash every month regardless of timing: the
    signature of a structural deficit rather than a collection gap.
    """
    assert profile.recurring_rules is not None
    share = profile.main_customer_concentration or 0.0
    total = 0.0
    for rule in profile.recurring_rules:
        amount = rule.amount_cents
        if stress.main_customer_lost and rule.exposure == "main_customer":
            amount = amount * (1 - share)
        total += (amount if rule.direction == "in" else -amount) * 30 / rule.interval_days
    return int(round(total))


def _survival(path: SimulationResult, horizon: int, net_flow_cents: int) -> dict:
    has_gap = bool(path.gap[0] > CENT_TOLERANCE)
    max_weeks = horizon // 7
    ending = float(path.ending_cash[0])
    if not has_gap:
        return {
            "weeks": max_weeks,
            "upper_bounded": True,
            "state": "stable",
            "first_obligation": None,
            "ending_cash_cents": int(round(ending)),
            "net_recurring_flow_cents": net_flow_cents,
        }
    day = int(path.first_day[0])
    weeks = day // 7
    # Tension: a timing gap — cash arrives later and the path recovers. Crisis: the gap
    # is structural — the path ends negative, the operation bleeds cash every month,
    # or the first uncovered obligation falls within four weeks.
    structural = ending < -CENT_TOLERANCE or net_flow_cents < 0 or weeks < CRISIS_WEEKS
    return {
        "weeks": weeks,
        "upper_bounded": False,
        "state": "crisis" if structural else "tension",
        "first_obligation": {
            "kind": str(path.first_node[0]),
            "day": day,
            "gap_cents": int(round(float(path.first_gap[0]))),
        },
        "ending_cash_cents": int(round(ending)),
        "net_recurring_flow_cents": net_flow_cents,
    }


def _reinforcement_kind(action: Action) -> str:
    return "advance" if action.kind == "accept_project" else "capital_injection"


def _apply_reinforcement(scenario: Scenario, kind: str, value: float) -> tuple[Action, Stress]:
    if kind == "advance":
        return scenario.action.with_parameter("advance_pct", value), scenario.stress
    injected = scenario.stress.capital_injection_cents + int(round(value))
    return scenario.action, Stress(
        scenario.stress.collection_delay_days, scenario.stress.main_customer_lost, injected
    )


def _origin_node(action: Action, stress: Stress) -> str:
    if stress.main_customer_lost:
        return "customer"
    if stress.collection_delay_days > 0 or action.kind in ("accept_project", "extend_credit"):
        return "delivery"
    return {"hire_staff": "hiring", "buy_asset": "materials", "request_financing": "debt"}.get(
        action.kind, "delivery"
    )


def analyze(request: EngineRequest) -> dict[str, Any]:
    profile = request.profile
    known, total = profile.coverage()
    base_result: dict[str, Any] = {
        "engine_version": ENGINE_VERSION,
        "coverage": {
            "known_variables": known,
            "total_variables": total,
            "unknown_fraction": round(1 - known / total, 4),
        },
        "seed": request.seed,
        "paths": request.paths,
        "horizon_days": request.horizon_days,
    }
    if profile.unknown_fraction() > ABSTENTION_UNKNOWN_FRACTION:
        return {
            **base_result,
            "status": "abstention",
            "reason": "insufficient data coverage: more than 20% of variables unknown",
        }
    if not MIN_PATHS <= request.paths <= MAX_PATHS:
        raise ValueError(f"paths must lie in [{MIN_PATHS}, {MAX_PATHS}]")
    request.action.validate()
    request.stress.validate()

    scenario = Scenario(profile, request.action, request.stress, request.horizon_days)

    # 1–2. Deterministic path with the stress controls applied and no random shock.
    path = scenario.run(deterministic(), trace=True)
    net_flow = recurring_net_flow(profile, request.stress)
    survival = _survival(path, request.horizon_days, net_flow)

    # 3. Monte Carlo. Search worlds use `seed`, verification worlds `seed + 1`, so the
    #    report's protocol (781 / 782) is one parameterization of this engine.
    search = worlds(request.paths, request.seed)
    verify = worlds(request.paths, request.seed + 1)
    before = summarize(scenario.run(verify))

    # 4. Minimum reinforcement on the one-step grid, verified on the same worlds.
    reinforcement: dict[str, Any] | None = None
    if request.action.kind != "none":
        kinds = [_reinforcement_kind(request.action)]
        if kinds[0] == "advance":
            kinds.append("capital_injection")  # fallback when no advance suffices
        chosen: float | None = None
        evaluated_total = 0
        kind = kinds[0]
        for kind in kinds:
            if kind == "advance":
                start = float(request.action.parameters["advance_pct"])
                grid = [float(v) for v in range(int(np.ceil(start)), 101)]
            else:
                grid = [INJECTION_CEILING_CENTS * k / 100 for k in range(101)]

            def run_with(value: float, kind: str = kind) -> SimulationResult:
                a, s = _apply_reinforcement(scenario, kind, value)
                return scenario.run(search, a, s)

            chosen, evaluated = search_minimum_reinforcement(
                run_with, grid, REINFORCEMENT_TOLERANCE
            )
            evaluated_total += len(evaluated)
            if chosen is not None:
                break
        if chosen is not None:
            a, s = _apply_reinforcement(scenario, kind, chosen)
            after = summarize(scenario.run(verify, a, s))
            after_path = scenario.run(deterministic(), a, s)
            after_survival = _survival(after_path, request.horizon_days, net_flow)
            if kind == "advance":
                amount = int(round(request.action.parameters["total_revenue_cents"] * chosen / 100))
                already = float(request.action.parameters["advance_pct"])
                reinforcement = {
                    "kind": "advance",
                    "percentage": chosen,
                    "amount_cents": amount,
                    "additional_percentage": chosen - already,
                }
            else:
                reinforcement = {
                    "kind": "capital_injection",
                    "percentage": None,
                    "amount_cents": int(round(chosen)),
                }
            reinforcement.update(
                {
                    "required": bool(before["ci95"][1] > REINFORCEMENT_TOLERANCE),
                    "gap_frequency_after": after["gap_frequency"],
                    "ci95_after": after["ci95"],
                    "weeks_after": after_survival["weeks"],
                    "upper_bounded_after": after_survival["upper_bounded"],
                    "state_after": after_survival["state"],
                    "found": True,
                    "grid_points_evaluated": evaluated_total,
                }
            )
        else:
            reinforcement = {
                "kind": kind,
                "percentage": None,
                "amount_cents": None,
                "required": True,
                "found": False,
                "grid_points_evaluated": evaluated_total,
            }

    # 5. Tension sweeps: the decision and the non-delay stress controls, everything
    #    else nominal. The delay control is itself the swept axis.
    sweep_stress = Stress(
        0, request.stress.main_customer_lost, request.stress.capital_injection_cents
    )
    points = breaking_points(lambda w: scenario.run(w, stress=sweep_stress))
    assert profile.payroll_cents and profile.contracted_term_days is not None
    assert profile.average_collection_days is not None
    assert profile.main_customer_concentration is not None
    factors = tension_factors(
        path,
        points,
        profile.payroll_cents,
        profile.contracted_term_days,
        profile.average_collection_days,
        profile.main_customer_concentration,
    )

    # Propagation path over the graph, from the origin the stress or action names.
    origin = _origin_node(request.action, request.stress)
    breaking = survival["first_obligation"]["kind"] if survival["first_obligation"] else None
    nodes = path_to(breaking or "payroll", origin) or path_to("payroll")
    collection_days = {k: int(v[0]) for k, v in path.effective_days.items()}

    return {
        **base_result,
        "status": "ok",
        "action": {"kind": request.action.kind, "parameters": request.action.parameters},
        "stress": {
            "collection_delay_days": request.stress.collection_delay_days,
            "main_customer_lost": request.stress.main_customer_lost,
            "capital_injection_cents": request.stress.capital_injection_cents,
        },
        "survival": survival,
        "simulation": before,
        "minimum_reinforcement": reinforcement,
        "breaking_points": points,
        "tension": factors,
        "propagation_path": {
            "nodes": nodes,
            "origin_node": "collection" if origin == "delivery" else origin,
            "breaking_node": breaking,
        },
        "effective_collection_days": collection_days,
        "cash_path_cents": [int(round(float(x))) for x in path.history[:, 0]]
        if path.history is not None
        else None,
    }
