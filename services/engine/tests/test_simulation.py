"""Vectorised simulation invariants: conservation, repeatability, rescheduling."""

import numpy as np
import pytest
from conftest import project

from engine.actions import Action
from engine.errors import ParameterError
from engine.simulation import deterministic, simulate, worlds
from engine.simulation.simulate import SimulationResult


def run(base, profile, action=None, world=None, delay=0) -> SimulationResult:
    movements = base + (action.movements(profile, 180) if action else [])
    return simulate(world or deterministic(), movements, profile.opening_balance_cents, 180, delay)


def test_cash_conservation(base, profile):
    r = run(base, profile, project(), worlds(500, 9))
    np.testing.assert_allclose(
        r.ending_cash, profile.opening_balance_cents + r.inflow - r.outflow, atol=1e-6
    )


def test_advance_is_not_extra_revenue(base, profile):
    a = run(base, profile, project(advance_pct=40))
    b = run(base, profile, project())
    assert a.ending_cash[0] == pytest.approx(b.ending_cash[0])


def test_delivery_delay_defers_the_receipt(base, profile):
    nominal = run(base, profile, project())
    delayed = run(base, profile, project(), deterministic(delivery_delay=7))
    assert (
        delayed.effective_days["project.collection"][0]
        - nominal.effective_days["project.collection"][0]
        == 7
    )


def test_base_without_project_has_no_gap(base, profile):
    assert run(base, profile).gap[0] == 0


def test_more_advance_cannot_worsen(base, profile):
    w = worlds(500, 100)
    assert np.all(
        run(base, profile, project(advance_pct=40), w).gap
        <= run(base, profile, project(), w).gap + 1e-6
    )


def test_repeatable_with_fixed_seed(base, profile):
    a = run(base, profile, project(), worlds(100, 8)).gap
    b = run(base, profile, project(), worlds(100, 8)).gap
    np.testing.assert_array_equal(a, b)


def test_late_receipt_is_censored(base, profile):
    r = run(base, profile, project(), delay=150)
    assert r.effective_days["project.collection"][0] == 210
    assert r.inflow[0] < 80_000_000 + 6 * 32_000_000


def test_custom_project_arithmetic(base, profile):
    a = Action(
        "accept_project",
        dict(
            total_revenue_cents=10_000_000,
            initial_cost_cents=1_000_000,
            advance_pct=0,
            collection_days=35,
            hires=1,
            hire_monthly_cost_cents=500_000,
            duration_days=20,
        ),
    )
    r = run(base, profile, a)
    assert r.effective_days["project.collection"][0] == 35
    expected = (
        66_000_000
        + 6 * 32_000_000
        + 10_000_000
        - 1_000_000
        - 1 * 500_000
        - 6 * 6_000_000
        - 12 * 12_000_000
    )
    assert r.ending_cash[0] == expected


def test_invalid_advance():
    with pytest.raises(ParameterError):
        project(advance_pct=110).validate()


def test_negative_amount_rejected():
    with pytest.raises(ParameterError):
        project(total_revenue_cents=-1).validate()


def test_vector_and_scalar_paths_agree(base, profile):
    """A 1-world Monte Carlo must match the grouped deterministic scheduler."""
    w = worlds(3, 5)
    vec = run(base, profile, project(), w)
    for i in range(3):
        single = deterministic(
            int(w.collection_delay[i]),
            float(w.sales_factor[i]),
            float(w.cost_factor[i]),
            int(w.delivery_delay[i]),
        )
        one = run(base, profile, project(), single)
        assert one.gap[0] == pytest.approx(vec.gap[i])
        assert one.first_day[0] == vec.first_day[i]
