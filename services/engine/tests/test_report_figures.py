"""The engine must regenerate docs/evaluation-report.md §3 byte for byte.

These are the figures the PRD allows the team to claim. If this file fails, the
report and the product no longer agree.
"""

import pytest
from conftest import project

from engine.actions import Action
from engine.analysis import EngineRequest, analyze
from engine.simulation import simulate, summarize, worlds
from engine.stress import Stress


@pytest.fixture(scope="module")
def verify():
    return worlds(20000, 782)


@pytest.mark.parametrize(
    "action, gaps, frequency, mean_pesos, p95_pesos",
    [
        (Action("none"), 0, 0.000, 0, 0),
        (project(), 9380, 0.469, 48_803, 195_558),
        (project(advance_pct=20), 1945, 0.097, 4_844, 35_558),
        (project(advance_pct=40), 62, 0.003, 145, 0),
        (project(advance_pct=25), 916, 0.046, 2_085, 0),
    ],
)
def test_report_table(base, profile, verify, action, gaps, frequency, mean_pesos, p95_pesos):
    """The report prints whole pesos; the engine keeps cents."""
    s = summarize(
        simulate(verify, base + action.movements(profile, 180), profile.opening_balance_cents)
    )
    assert s["gap_count"] == gaps
    assert round(s["gap_frequency"], 3) == frequency
    assert round(s["mean_gap_cents"] / 100) == mean_pesos
    assert round(s["p95_gap_cents"] / 100) == p95_pesos


def test_report_protocol_end_to_end(profile):
    """Search seed 781, verification seed 782, 20,000 futures, zero delay."""
    result = analyze(EngineRequest(profile, project(), Stress(), 20000, 781))
    bp = result["breaking_points"]
    assert bp["collection_delay"] == {
        "additional_days": 16,
        "first_day": 75,
        "first_node": "payroll",
        "gap_cents": 4_000_000,
        "max_gap_cents": 4_000_000,
        "bounded": False,
    }
    assert bp["sales_drop"]["drop_pp"] == 10.0 and bp["cost_increase"]["increase_pp"] == 7.0
    r = result["minimum_reinforcement"]
    assert r["kind"] == "advance" and r["percentage"] == 25.0 and r["amount_cents"] == 20_000_000
    assert round(r["gap_frequency_after"], 3) == 0.046
    assert result["propagation_path"]["nodes"] == [
        "delivery",
        "invoice",
        "collection",
        "cash",
        "payroll",
    ]


def test_prd_tension_table_at_sixteen_days(profile):
    """PRD §3.3 verification table."""
    result = analyze(EngineRequest(profile, project(), Stress(collection_delay_days=16), 5000, 42))
    by = {f["factor"]: f for f in result["tension"]}
    assert (
        by["payroll_coverage"]["tension"] == 1.00
        and by["payroll_coverage"]["margin_cents"] == -4_000_000
    )
    assert by["average_collection_period"]["tension"] == 0.75
    assert by["collection_delay_tolerance"]["tension"] == 0.73
    assert by["cost_increase_tolerance"]["tension"] == 0.65
    assert by["sales_drop_tolerance"]["tension"] == 0.50
    assert by["main_customer_concentration"]["tension"] == 0.46
    assert [f["factor"] for f in result["tension"]] == [
        "payroll_coverage",
        "average_collection_period",
        "collection_delay_tolerance",
        "cost_increase_tolerance",
        "sales_drop_tolerance",
        "main_customer_concentration",
    ]
    assert result["survival"] == {**result["survival"], "weeks": 10, "state": "tension"}


def test_fifteen_days_is_covered_sixteen_is_not(profile):
    for days, gap in ((15, 0), (16, 4_000_000)):
        r = analyze(EngineRequest(profile, project(), Stress(collection_delay_days=days), 100, 1))
        first = r["survival"]["first_obligation"]
        assert (first["gap_cents"] if first else 0) == gap
