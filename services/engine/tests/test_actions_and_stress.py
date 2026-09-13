"""The five decisions and the stress controls as calendar transformations."""

import pytest
from conftest import project

from engine.actions import Action
from engine.errors import ParameterError
from engine.simulation import deterministic, simulate
from engine.stress import Stress


def total(movements, direction):
    return sum(m.amount_cents for m in movements if m.direction == direction)


def test_no_action_predates_cutoff(profile):
    actions = [
        project(),
        Action(
            "extend_credit", dict(amount_cents=1_000_000, collection_days=30, main_customer=True)
        ),
        Action("hire_staff", dict(headcount=1, monthly_unit_cost_cents=3_000_000, start_day=5)),
        Action(
            "buy_asset",
            dict(
                amount_cents=10_000_000, financed_pct=50, financing_term_months=6, delivery_days=10
            ),
        ),
        Action(
            "request_financing",
            dict(amount_cents=10_000_000, annual_rate_pct=24, term_months=12, grace_months=2),
        ),
    ]
    for a in actions:
        assert all(m.day >= 0 and m.provenance == "declared" for m in a.movements(profile, 180))


def test_accept_project_reschedules_revenue_only(profile):
    plain, advanced = (
        project().movements(profile, 180),
        project(advance_pct=30).movements(profile, 180),
    )
    assert total(plain, "in") == total(advanced, "in") == 80_000_000
    assert {m.id for m in plain if m.node == "hiring"} == {"project.hiring@30", "project.hiring@60"}


def test_extend_credit_defers_without_creating_revenue(profile):
    m = Action(
        "extend_credit", dict(amount_cents=5_000_000, collection_days=45, main_customer=True)
    ).movements(profile, 180)
    assert total(m, "in") == total(m, "out") == 5_000_000
    deferred = next(x for x in m if x.direction == "in")
    assert (
        deferred.day == 45
        and deferred.shift == "collection"
        and deferred.exposure == "main_customer"
    )


def test_hire_staff_recurs_every_payroll(profile):
    m = Action(
        "hire_staff", dict(headcount=2, monthly_unit_cost_cents=3_000_000, start_day=0)
    ).movements(profile, 180)
    assert len(m) == 12 and all(x.node == "payroll" and x.amount_cents == 3_000_000 for x in m)


def test_buy_asset_splits_down_payment_and_installments(profile):
    m = Action(
        "buy_asset",
        dict(amount_cents=12_000_000, financed_pct=50, financing_term_months=3, delivery_days=0),
    ).movements(profile, 180)
    assert total(m, "out") == 12_000_000
    assert [x.day for x in m if x.node == "debt"] == [30, 60, 90]


def test_request_financing_amortizes(profile):
    m = Action(
        "request_financing",
        dict(amount_cents=12_000_000, annual_rate_pct=0, term_months=6, grace_months=0),
    ).movements(profile, 180)
    assert total(m, "in") == 12_000_000 and total(m, "out") == 12_000_000


def test_financing_grace_must_be_shorter_than_term():
    with pytest.raises(ParameterError):
        Action(
            "request_financing",
            dict(amount_cents=1, annual_rate_pct=1, term_months=3, grace_months=3),
        ).validate()


def test_main_customer_loss_removes_concentration_share(base, profile):
    stressed = Stress(main_customer_lost=True).apply(base, profile)
    receipts = [m for m in stressed if m.id.startswith("base.receipts")]
    assert all(m.amount_cents == round(32_000_000 * 0.54) for m in receipts)


def test_capital_injection_is_a_day_zero_inflow(base, profile):
    stressed = Stress(capital_injection_cents=20_000_000).apply(base, profile)
    injection = stressed[-1]
    assert injection.day == 0 and injection.direction == "in" and injection.node == "cash"


def test_injection_of_the_deterministic_gap_restores_coverage(base, profile):
    calendar = base + project().movements(profile, 180)
    with_gap = simulate(deterministic(16), calendar, profile.opening_balance_cents, 180, 16)
    assert with_gap.gap[0] == 4_000_000
    fixed = simulate(
        deterministic(16),
        Stress(capital_injection_cents=4_000_000).apply(calendar, profile),
        profile.opening_balance_cents,
        180,
        16,
    )
    assert fixed.gap[0] == 0
