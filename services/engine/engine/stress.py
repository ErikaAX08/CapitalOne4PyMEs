"""Stress controls applied on top of any decision.

- `collection_delay_days` shifts every movement exposed to collection delay.
- `main_customer_lost` removes the main customer's share from exposed receipts.
- `capital_injection_cents` adds a day-0 inflow to cash.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from engine.cash.movements import Movement
from engine.cash.profile import CompanyProfile
from engine.errors import ParameterError


@dataclass(frozen=True)
class Stress:
    collection_delay_days: int = 0
    main_customer_lost: bool = False
    capital_injection_cents: int = 0

    def validate(self) -> None:
        if self.collection_delay_days < 0 or self.capital_injection_cents < 0:
            raise ParameterError("stress controls must be non-negative")

    def apply(self, movements: list[Movement], profile: CompanyProfile) -> list[Movement]:
        self.validate()
        out: list[Movement] = []
        share = profile.main_customer_concentration or 0.0
        for m in movements:
            if self.main_customer_lost and m.exposure == "main_customer":
                kept = int(round(m.amount_cents * (1 - share)))
                m = replace(m, amount_cents=kept)
            out.append(m)
        if self.capital_injection_cents:
            out.append(
                Movement("stress.capital_injection", "cash", "in", 0, self.capital_injection_cents)
            )
        return out
