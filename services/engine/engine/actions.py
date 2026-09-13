"""The five decisions as transformations of the cash calendar.

Each action is an immutable value object that produces movements. It knows
nothing about Monte Carlo, probabilities or the interface. Parameters arrive as
integer cents, integer days and float percentages, exactly as the query string
and `contracts/actions.schema.json` declare them.

Shared invariants:
- no action increases total revenue; it reschedules it in time;
- no movement predates the cut-off date (day 0);
- every action-generated movement is `declared` by the user, never `learned`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from engine.cash.movements import Movement
from engine.cash.profile import CompanyProfile
from engine.errors import ParameterError

ACTION_KINDS = (
    "none",
    "accept_project",
    "extend_credit",
    "hire_staff",
    "buy_asset",
    "request_financing",
)


@dataclass(frozen=True)
class Action:
    kind: str
    parameters: dict[str, Any] = field(default_factory=dict)

    def validate(self) -> None:
        if self.kind not in ACTION_KINDS:
            raise ParameterError(f"unknown action: {self.kind}")
        p = self.parameters
        for key, value in p.items():
            if isinstance(value, bool):
                continue
            if isinstance(value, (int, float)) and value < 0:
                raise ParameterError(f"{key} must be non-negative")
        if self.kind == "accept_project":
            if not 0 <= p["advance_pct"] <= 100:
                raise ParameterError("advance_pct must lie in [0, 100]")
            if p["collection_days"] < p.get("duration_days", 30):
                raise ParameterError("collection_days must not precede delivery")
        if self.kind == "buy_asset" and not 0 <= p["financed_pct"] <= 100:
            raise ParameterError("financed_pct must lie in [0, 100]")
        if self.kind == "request_financing" and p["grace_months"] >= p["term_months"]:
            raise ParameterError("grace_months must be shorter than term_months")

    def movements(self, profile: CompanyProfile, horizon: int) -> list[Movement]:
        self.validate()
        builder = _BUILDERS[self.kind]
        return builder(self.parameters, profile, horizon)

    def with_parameter(self, key: str, value: Any) -> Action:
        return Action(self.kind, {**self.parameters, key: value})

    def total_revenue_cents(self) -> int:
        """Revenue introduced by the action; used to verify the rescheduling invariant."""
        if self.kind == "accept_project":
            return int(self.parameters["total_revenue_cents"])
        if self.kind == "request_financing":
            return int(self.parameters["amount_cents"])
        return 0


def _none(_: dict, __: CompanyProfile, ___: int) -> list[Movement]:
    return []


def _accept_project(p: dict, profile: CompanyProfile, horizon: int) -> list[Movement]:
    revenue = int(p["total_revenue_cents"])
    cost = int(p["initial_cost_cents"])
    advance = float(p["advance_pct"]) / 100
    collection_day = int(p["collection_days"])
    hires = int(p["hires"])
    delivery_day = int(p.get("duration_days", profile.project_delivery_day))
    monthly = int(p.get("hire_monthly_cost_cents", profile.hire_monthly_cost_cents))
    advance_cents = int(round(revenue * advance))
    out: list[Movement] = []
    if advance_cents:
        # The advance is cash brought forward: not delayed, not scaled, not extra revenue.
        out.append(Movement("project.advance", "collection", "in", 0, advance_cents))
    out.append(
        Movement(
            "project.collection",
            "collection",
            "in",
            collection_day,
            revenue - advance_cents,
            shift="collection",
        )
    )
    if cost:
        out.append(Movement("project.materials", "materials", "out", 0, cost, scale="cost"))
    # Project staff is paid monthly from the first month until the project is collected.
    if hires and monthly:
        day = 30
        while day <= max(collection_day, delivery_day) and day <= horizon:
            out.append(
                Movement(
                    f"project.hiring@{day}", "hiring", "out", day, hires * monthly, scale="cost"
                )
            )
            day += 30
    return out


def _extend_credit(p: dict, profile: CompanyProfile, horizon: int) -> list[Movement]:
    """A sale of `amount_cents` that would be collected now is collected at `collection_days`.

    Modelled as the pair (−amount at day 0, +amount at collection_days): total revenue
    is unchanged, only its timing. The deferred receipt is exposed to collection delay.
    """
    amount = int(p["amount_cents"])
    day = int(p["collection_days"])
    exposure = "main_customer" if p.get("main_customer") else "none"
    return [
        Movement("credit.forgone_cash_sale", "collection", "out", 0, amount, priority=0),
        Movement(
            "credit.deferred_collection",
            "collection",
            "in",
            day,
            amount,
            shift="collection",
            exposure=exposure,
        ),
    ]


def _hire_staff(p: dict, profile: CompanyProfile, horizon: int) -> list[Movement]:
    headcount = int(p["headcount"])
    monthly = int(p["monthly_unit_cost_cents"])
    start = int(p.get("start_day", 0))
    interval = profile.payroll_interval_days or 15
    per_period = int(round(headcount * monthly * interval / 30))
    out: list[Movement] = []
    day = ((start // interval) + 1) * interval
    while day <= horizon:
        out.append(Movement(f"hire.payroll@{day}", "payroll", "out", day, per_period))
        day += interval
    return out


def _buy_asset(p: dict, profile: CompanyProfile, horizon: int) -> list[Movement]:
    amount = int(p["amount_cents"])
    financed = float(p["financed_pct"]) / 100
    term = int(p["financing_term_months"])
    delivery = int(p.get("delivery_days", 0))
    financed_cents = int(round(amount * financed))
    out = [
        Movement("asset.down_payment", "materials", "out", 0, amount - financed_cents, scale="none")
    ]
    if financed_cents and term:
        installment = financed_cents // term
        remainder = financed_cents - installment * term
        for k in range(1, term + 1):
            day = delivery + 30 * k
            if day > horizon:
                break
            out.append(
                Movement(
                    f"asset.installment@{day}",
                    "debt",
                    "out",
                    day,
                    installment + (remainder if k == term else 0),
                )
            )
    return out


def _request_financing(p: dict, profile: CompanyProfile, horizon: int) -> list[Movement]:
    amount = int(p["amount_cents"])
    rate = float(p["annual_rate_pct"]) / 100 / 12
    term = int(p["term_months"])
    grace = int(p["grace_months"])
    out = [Movement("loan.disbursement", "credit", "in", 0, amount)]
    remaining = term - grace
    if rate > 0:
        level = amount * rate / (1 - (1 + rate) ** (-remaining))
    else:
        level = amount / remaining
    for k in range(1, term + 1):
        day = 30 * k
        if day > horizon:
            break
        payment = amount * rate if k <= grace else level
        out.append(Movement(f"loan.service@{day}", "debt", "out", day, int(round(payment))))
    return out


_BUILDERS = {
    "none": _none,
    "accept_project": _accept_project,
    "extend_credit": _extend_credit,
    "hire_staff": _hire_staff,
    "buy_asset": _buy_asset,
    "request_financing": _request_financing,
}
