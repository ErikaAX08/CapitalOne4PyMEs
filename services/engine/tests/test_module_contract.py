"""PRD module contract: every field each card needs is present in every fixture.

This test is the executable form of docs/module-contract.md. If a card needs a
field the engine does not emit, this file fails before the front-end does.
"""

import json

import pytest
from conftest import ROOT

FIXTURES = {p.stem: json.loads(p.read_text()) for p in (ROOT / "fixtures" / "states").glob("*.json")}
FORBIDDEN = ("topológic", "topologic", "tda", "persistencia")


@pytest.fixture(params=sorted(FIXTURES))
def doc(request):
    return FIXTURES[request.param]


def test_module_a_survival_indicator(doc):
    s = doc["survival"]
    assert isinstance(s["weeks"], int) and isinstance(s["upper_bounded"], bool)
    assert s["state"] == doc["state_id"] and s["state_label"] == doc["state_label"]
    assert s["headline"]
    if s["first_obligation"]:
        f = s["first_obligation"]
        assert {"kind", "label", "day", "date", "date_text", "gap_cents"} <= set(f)
        assert f["label"].istitle() or f["label"] == f["label"].title()
        assert f["date_text"] in s["headline"] or f"día {f['day']}" in s["headline"]
        assert not s["upper_bounded"]
    else:
        assert s["upper_bounded"] and s["weeks"] == doc["horizon_days"] // 7
    assert doc["definitions"]["survival_weeks"]


def test_module_b_parameterization_echo(doc):
    p = doc["parameterization"]
    assert p["action"] in ("none", "accept_project", "extend_credit", "hire_staff", "buy_asset", "request_financing")
    assert {"collection_delay_days", "main_customer_lost", "capital_injection_cents"} <= set(p)
    assert doc["seed"] == 42 and doc["simulation"]["paths"] == 5000


def test_module_c_tension_radar(doc):
    t = doc["tension"]
    assert [f["factor"] for f in t] and len(t) == 6
    assert [f["tension"] for f in t] == sorted((f["tension"] for f in t), reverse=True)
    for f in t:
        assert 0 <= f["tension"] <= 1 and f["label"] and f["stack_label"]
        inputs = {k for k in f if k.startswith(("margin", "range"))} - {"range_source"}
        assert len(inputs) == 2, f"{f['factor']} must travel with margin and range"
        if f["factor"] in ("cost_increase_tolerance", "sales_drop_tolerance"):
            assert f["range_source"] == "declared_assumption"
    assert doc["definitions"]["tension"]


def test_module_d_reinforcement_and_path(doc):
    path = doc["propagation_path"]
    assert path["nodes"] and set(path["nodes"]) <= set(path["node_labels"])
    assert path["origin_node"] in path["nodes"]
    assert path["breaking_node"] is None or path["breaking_node"] == path["nodes"][-1]
    r = doc["minimum_reinforcement"]
    if doc["parameterization"]["action"] == "none":
        assert r is None
    else:
        assert r["label"] and r["before"]["state"] == doc["state_id"]
        assert r["before"]["gap_frequency"] == doc["simulation"]["gap_frequency"]
        if r.get("found"):
            assert {"gap_frequency_after", "weeks_after", "state_after", "state_label_after"} <= set(r)
    assert doc["explanation"]
    if doc["survival"]["first_obligation"]:
        assert "$" in doc["explanation"]


def test_module_e_limitations_strip(doc):
    assert doc["warnings"] and [n["code"] for n in doc["notices"]] == doc["warnings"]
    assert all(n["label"] for n in doc["notices"])
    assert {"synthetic_assumptions", "no_mexico_validation"} <= set(doc["warnings"])
    assert doc["engine_version"] and doc["currency"] == "MXN" and doc["schema"] == "v1"


def test_integrity_rules(doc):
    text = json.dumps(doc, ensure_ascii=False).lower()
    assert not any(w in text for w in FORBIDDEN)
    for banned in ("precisión de 90", "predice quiebras", "evita quiebras", "probabilidad calibrada de"):
        assert banned not in text
