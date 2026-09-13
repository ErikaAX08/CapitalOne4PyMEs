"""Monte Carlo worlds.

One common adverse shock links slower delivery, slower collection, lower sales and
higher costs. The parameters are declared assumptions, not estimates from
companies; the formulas are kept identical to the evaluation report so that its
figures regenerate byte for byte.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class World:
    delivery_delay: np.ndarray
    collection_delay: np.ndarray
    sales_factor: np.ndarray
    cost_factor: np.ndarray

    @property
    def n(self) -> int:
        return len(self.sales_factor)


def worlds(n: int, seed: int, stress: float = 1.0) -> World:
    r = np.random.default_rng(seed)
    common = r.normal(size=n)
    delivery = np.maximum(0, np.rint(6 + stress * (6 * common + 4 * r.normal(size=n)))).astype(int)
    collection = np.maximum(0, np.rint(8 + stress * (5 * common + 6 * r.normal(size=n)))).astype(
        int
    )
    var = 0.5 * stress**2 * (0.07**2 + 0.05**2)
    sales = np.exp(-stress * 0.07 * common + stress * 0.05 * r.normal(size=n) - var)
    cost = np.exp(stress * 0.07 * common + stress * 0.05 * r.normal(size=n) - var)
    return World(delivery, collection, sales, cost)


def deterministic(
    delay: int = 0, sales: float = 1.0, cost: float = 1.0, delivery_delay: int = 0
) -> World:
    """A single world with no random shock: the deterministic path."""
    return World(
        np.array([delivery_delay]),
        np.array([delay]),
        np.array([float(sales)]),
        np.array([float(cost)]),
    )
