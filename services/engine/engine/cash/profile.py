"""Company profile and the recurring rules that generate its base calendar.

The profile is the engine's view of the `companies`, `recurring_rules` and
`company_snapshots` tables in the data model. Everything the deterministic engine
needs about the business, before any decision is applied, lives here.

Unknown values are represented as `None` and counted by `coverage()`. They are
never replaced with zero: the risk domain turns low coverage into an abstention.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from engine.cash.movements import Movement
from engine.errors import DataQualityError

# Profile variables that the analysis depends on. Coverage is measured over them.
COVERAGE_VARIABLES = (
    "opening_balance_cents",
    "payroll_cents",
    "payroll_interval_days",
    "main_customer_concentration",
    "contracted_term_days",
    "average_collection_days",
    "recurring_rules",
)


@dataclass(frozen=True)
class RecurringRule:
    """A movement repeated every `interval_days` from `first_day` up to the horizon."""

    id: str
    node: str
    direction: str
    amount_cents: int
    first_day: int
    interval_days: int
    shift: str = "none"
    scale: str = "none"
    exposure: str = "none"
    provenance: str = "known"

    def expand(self, horizon: int) -> list[Movement]:
        if self.interval_days <= 0:
            raise DataQualityError(f"recurring rule {self.id} has a non-positive interval")
        out: list[Movement] = []
        day = self.first_day
        while day <= horizon:
            out.append(
                Movement(
                    id=f"{self.id}@{day}",
                    node=self.node,
                    direction=self.direction,
                    day=day,
                    amount_cents=self.amount_cents,
                    shift=self.shift,
                    scale=self.scale,
                    exposure=self.exposure,
                    provenance=self.provenance,
                )
            )
            day += self.interval_days
        return out


@dataclass(frozen=True)
class CompanyProfile:
    company_id: str
    currency: str = "MXN"
    opening_balance_cents: int | None = None
    payroll_cents: int | None = None
    payroll_interval_days: int | None = 15
    main_customer_concentration: float | None = None
    contracted_term_days: int | None = None
    average_collection_days: int | None = None
    # Nominal day of delivery and invoicing for a project accepted at the cut-off.
    project_delivery_day: int = 30
    # Monthly cost of one project hire, used by accept_project.
    hire_monthly_cost_cents: int = 4_500_000
    recurring_rules: tuple[RecurringRule, ...] | None = field(default=None)
    one_off_movements: tuple[Movement, ...] = field(default_factory=tuple)

    def coverage(self) -> tuple[int, int]:
        """(known variables, total variables) over COVERAGE_VARIABLES."""
        known = sum(getattr(self, name) is not None for name in COVERAGE_VARIABLES)
        return known, len(COVERAGE_VARIABLES)

    def unknown_fraction(self) -> float:
        known, total = self.coverage()
        return 1 - known / total

    def require_complete(self) -> None:
        missing = [name for name in COVERAGE_VARIABLES if getattr(self, name) is None]
        if missing:
            raise DataQualityError("profile variables unknown: " + ", ".join(missing))

    @staticmethod
    def from_dict(data: dict[str, Any]) -> CompanyProfile:
        rules = data.get("recurring_rules")
        one_offs = data.get("one_off_movements") or []
        return CompanyProfile(
            company_id=data["company_id"],
            currency=data.get("currency", "MXN"),
            opening_balance_cents=data.get("opening_balance_cents"),
            payroll_cents=data.get("payroll_cents"),
            payroll_interval_days=data.get("payroll_interval_days", 15),
            main_customer_concentration=data.get("main_customer_concentration"),
            contracted_term_days=data.get("contracted_term_days"),
            average_collection_days=data.get("average_collection_days"),
            project_delivery_day=data.get("project_delivery_day", 30),
            hire_monthly_cost_cents=data.get("hire_monthly_cost_cents", 4_500_000),
            recurring_rules=None if rules is None else tuple(RecurringRule(**r) for r in rules),
            one_off_movements=tuple(Movement(**m) for m in one_offs),
        )


def base_calendar(profile: CompanyProfile, horizon: int) -> list[Movement]:
    """Movements of the current operation, without any decision applied."""
    profile.require_complete()
    assert profile.recurring_rules is not None and profile.payroll_cents is not None
    movements: list[Movement] = []
    for rule in profile.recurring_rules:
        movements.extend(rule.expand(horizon))
    movements.extend(profile.one_off_movements)
    payroll_ids = {m.id for m in movements if m.node == "payroll"}
    if not payroll_ids:
        # Payroll is the critical obligation of the vertical; derive it from the profile.
        interval = profile.payroll_interval_days or 15
        movements.extend(
            RecurringRule(
                "payroll", "payroll", "out", profile.payroll_cents, interval, interval
            ).expand(horizon)
        )
    return movements
