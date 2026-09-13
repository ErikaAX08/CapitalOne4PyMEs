"""Canonical cash movements and the deterministic ledger.

A movement is one dated obligation or receipt of the company, relative to the
cut-off date (day 0). It is the row of the `movements` table in the data model
(`contracts/database/schema.sql`) and the unit every other module consumes.

Ported from the original `motor.normalize` and `motor.ledger`; the invariants
those functions enforced are kept verbatim:

- critical fields are never allowed to be unknown (an unknown balance is never zero);
- information known after the cut-off date is rejected;
- a settled amount must lie within [0, amount], and the movement is reduced by it;
- an exact duplicate is excluded with a warning, a conflicting duplicate is an error;
- receipts are applied before commitments within a day, then numeric priority.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, replace

from engine.errors import DataQualityError

DIRECTIONS = ("in", "out")
SHIFTS = ("none", "delivery", "collection")
SCALES = ("none", "sales", "cost")
EXPOSURES = ("none", "main_customer")
PROVENANCES = ("known", "declared", "learned", "hypothetical")

# Intraday priority of outgoing commitments. Lower is paid first. Receipts always
# precede commitments, so a same-day collection covers a same-day payroll.
DEFAULT_PRIORITY = {
    "materials": 10,
    "hiring": 20,
    "supplier": 30,
    "payroll": 40,
    "debt": 50,
    "tax": 60,
}

# Amounts below half a cent are treated as zero.
CENT_TOLERANCE = 0.5


@dataclass(frozen=True)
class Movement:
    """One cash movement relative to the cut-off date. Amounts are integer cents."""

    id: str
    node: str
    direction: str
    day: int
    amount_cents: int
    shift: str = "none"  # which stochastic delays move it: none | delivery | collection
    scale: str = "none"  # which stochastic factor scales it: none | sales | cost
    exposure: str = "none"  # none | main_customer — amount includes the main customer's share
    priority: int | None = None
    known_at: int = 0
    settled_cents: int = 0
    provenance: str = "declared"

    def effective_priority(self) -> int:
        if self.priority is not None:
            return self.priority
        return DEFAULT_PRIORITY.get(self.node, 99)

    def sort_key(self) -> tuple[int, int, str]:
        return (0 if self.direction == "in" else 1, self.effective_priority(), self.id)


def normalize(movements: Iterable[Movement], asof: int = 0) -> tuple[list[Movement], list[str]]:
    """Validate and reduce movements to their outstanding amount.

    Returns the clean list and the warnings raised while cleaning. Raises
    DataQualityError on anything that would require reconciliation.
    """
    seen: dict[str, Movement] = {}
    clean: list[Movement] = []
    warnings: list[str] = []
    for m in movements:
        for field in ("id", "day", "amount_cents", "direction", "node", "known_at"):
            if getattr(m, field) is None:
                raise DataQualityError(f"critical field unknown: {field} on {m.id!r}")
        if m.known_at > asof:
            raise DataQualityError(f"future information not available at cut-off: {m.id}")
        if m.direction not in DIRECTIONS:
            raise DataQualityError(f"invalid direction on {m.id}: {m.direction}")
        if m.shift not in SHIFTS or m.scale not in SCALES or m.exposure not in EXPOSURES:
            raise DataQualityError(f"invalid shift/scale/exposure on {m.id}")
        if m.provenance not in PROVENANCES:
            raise DataQualityError(f"invalid provenance on {m.id}: {m.provenance}")
        if m.day < asof:
            raise DataQualityError(f"past due date, reconcile before simulating: {m.id}")
        if not isinstance(m.amount_cents, int) or m.amount_cents < 0:
            raise DataQualityError(f"invalid amount on {m.id}")
        paid = m.settled_cents
        if paid is None or not isinstance(paid, int) or not 0 <= paid <= m.amount_cents:
            raise DataQualityError(f"inconsistent reconciliation on {m.id}")
        if m.id in seen:
            if seen[m.id] != m:
                raise DataQualityError(f"duplicate with conflict: {m.id}")
            warnings.append(f"duplicate excluded: {m.id}")
            continue
        seen[m.id] = m
        outstanding = m.amount_cents - paid
        if outstanding:
            clean.append(replace(m, amount_cents=outstanding, settled_cents=0))
    return clean, warnings


def ledger(opening_cents: int | None, movements: Iterable[Movement], horizon: int = 180) -> dict:
    """Deterministic scalar ledger: nominal days, no shocks.

    Used by the reconciliation tests and as the reference implementation of the
    intraday ordering convention.
    """
    if opening_cents is None or not isinstance(opening_cents, int) or opening_cents < 0:
        raise DataQualityError("opening balance unknown or invalid")
    clean, _ = normalize(movements)
    ordered = sorted(clean, key=lambda m: (m.day, *m.sort_key()))
    cash = opening_cents
    minimum = opening_cents
    first: dict | None = None
    entries: list[dict] = []
    for m in ordered:
        if m.day > horizon:
            continue
        before = cash
        cash += m.amount_cents if m.direction == "in" else -m.amount_cents
        minimum = min(minimum, cash)
        if cash < 0 and first is None:
            first = {"id": m.id, "day": m.day, "node": m.node, "gap_cents": -cash}
        entries.append(
            {
                "id": m.id,
                "day": m.day,
                "node": m.node,
                "direction": m.direction,
                "amount_cents": m.amount_cents,
                "cash_before": before,
                "cash_after": cash,
            }
        )
    return {
        "first_gap": first,
        "max_gap_cents": max(0, -minimum),
        "ending_cash_cents": cash,
        "entries": entries,
    }
