"""Reconciliation and ledger invariants, ported from the original 30-test suite."""

import pytest

from engine.cash import Movement, ledger, normalize
from engine.errors import DataQualityError


def event(**kw) -> Movement:
    base = dict(id="i", day=10, amount_cents=100, direction="out", node="payroll", known_at=0)
    base.update(kw)
    return Movement(**base)


def test_missing_opening_balance_is_never_zero():
    with pytest.raises(DataQualityError):
        ledger(None, [])


def test_missing_critical_field():
    with pytest.raises(DataQualityError):
        normalize([event(amount_cents=None)])


def test_duplicate_excluded_with_warning():
    e = event()
    clean, warnings = normalize([e, e])
    assert len(clean) == 1 and warnings == ["duplicate excluded: i"]


def test_duplicate_with_conflict():
    with pytest.raises(DataQualityError):
        normalize([event(), event(amount_cents=90)])


def test_fully_settled_disappears():
    assert normalize([event(settled_cents=100)])[0] == []


def test_partial_settlement_reduces_amount():
    assert normalize([event(settled_cents=40)])[0][0].amount_cents == 60


def test_over_settlement():
    with pytest.raises(DataQualityError):
        normalize([event(settled_cents=101)])


def test_future_information_rejected():
    with pytest.raises(DataQualityError):
        normalize([event(known_at=1)])


def test_past_due_requires_reconciliation():
    with pytest.raises(DataQualityError):
        normalize([event(day=3)], asof=5)


def test_first_obligation_and_max_gap():
    r = ledger(80, [event()])
    assert r["first_gap"]["node"] == "payroll" and r["max_gap_cents"] == 20


def test_exact_coverage_is_not_a_gap():
    assert ledger(100, [event()])["first_gap"] is None


def test_receipt_before_commitment_within_a_day():
    receipt = event(id="receipt", direction="in")
    assert ledger(0, [event(), receipt])["first_gap"] is None


def test_priority_orders_commitments():
    supplier = event(id="s", node="supplier", amount_cents=60)
    payroll = event(id="p", node="payroll", amount_cents=60)
    r = ledger(100, [payroll, supplier])
    assert r["first_gap"]["node"] == "payroll"  # supplier (30) is paid before payroll (40)


def test_known_seasonal_commitment_is_covered():
    assert ledger(400, [event(amount_cents=300)])["max_gap_cents"] == 0


def test_invalid_direction_and_provenance():
    with pytest.raises(DataQualityError):
        normalize([event(direction="sideways")])
    with pytest.raises(DataQualityError):
        normalize([event(provenance="guessed")])
