"""Projection, contract validation, fallback states and the Lambda handler."""

import json
from datetime import date

import pytest
from conftest import ROOT, project

from engine.analysis import EngineRequest, analyze
from engine.cash.profile import CompanyProfile
from engine.contracts import request_from_query, state_schema
from engine.handler import handler
from engine.projection import to_state_document
from engine.stress import Stress

jsonschema = pytest.importorskip("jsonschema")
FORBIDDEN = ("topológic", "topologic", "TDA", "persistencia")


def validate(document: dict) -> None:
    jsonschema.Draft202012Validator(state_schema()).validate(document)


def test_four_fallback_states_validate_and_match_prd(profile_dict):
    expected = {
        "base": ("stable", 25),
        "tension": ("tension", 10),
        "crisis": ("crisis", None),
        "reinforced": ("stable", 25),
    }
    for name, (state_id, weeks) in expected.items():
        doc = json.loads((ROOT / "fixtures" / "states" / f"{name}.json").read_text())
        validate(doc)
        assert doc["state_id"] == state_id
        if weeks is not None:
            assert doc["survival"]["weeks"] == weeks
        assert doc["warnings"] and doc["explanation"]
        assert not any(
            word.lower() in json.dumps(doc, ensure_ascii=False).lower() for word in FORBIDDEN
        )


def test_web_and_engine_fixtures_are_identical():
    web = ROOT.parents[1] / "apps" / "web" / "public" / "states"
    for path in (ROOT / "fixtures" / "states").glob("*.json"):
        assert (web / path.name).read_text() == path.read_text()


def test_explanation_changes_with_parameters(profile):
    a = analyze(EngineRequest(profile, project(), Stress(16), 500, 42))
    b = analyze(
        EngineRequest(
            profile,
            project(total_revenue_cents=120_000_000, initial_cost_cents=57_000_000),
            Stress(16),
            500,
            42,
        )
    )
    da, db = (to_state_document(x, "co", date(2026, 9, 12)) for x in (a, b))
    assert da["explanation"] != db["explanation"]
    assert "día 76" in da["explanation"] and "$40,000" in da["explanation"]
    assert da["survival"]["first_obligation"]["date"] == "2026-11-26"


def test_abstention_above_twenty_percent_unknown(profile_dict):
    incomplete = CompanyProfile.from_dict(
        {**profile_dict, "opening_balance_cents": None, "average_collection_days": None}
    )
    result = analyze(EngineRequest(incomplete, project(), Stress(), 500, 42))
    assert result["status"] == "abstention"
    doc = to_state_document(result, "co", date(2026, 9, 12))
    validate(doc)
    assert doc["state_id"] == "abstention" and "insufficient_data_coverage" in doc["warnings"]


def test_query_defaults_reproduce_the_report_parameterization(profile_dict):
    payload = request_from_query({}, profile_dict)
    assert payload["action"] == {
        "kind": "accept_project",
        "parameters": {
            "total_revenue_cents": 80_000_000,
            "initial_cost_cents": 38_000_000,
            "advance_pct": 0,
            "collection_days": 60,
            "hires": 2,
            "duration_days": 30,
        },
    }
    assert payload["stress"] == {
        "collection_delay_days": 0,
        "main_customer_lost": False,
        "capital_injection_cents": 0,
    }
    assert payload["paths"] == 5000 and payload["seed"] == 42


def test_query_bounds_are_enforced(profile_dict):
    from engine.errors import ParameterError

    with pytest.raises(ParameterError):
        request_from_query({"advance_pct": "61"}, profile_dict)
    with pytest.raises(ParameterError):
        request_from_query({"total_revenue_cents": "12.5"}, profile_dict)


def test_http_handler_is_cacheable_and_pure():
    event = {
        "rawQueryString": "collection_delay_days=16",
        "queryStringParameters": {"collection_delay_days": "16"},
    }
    a, b = handler(event), handler(event)
    assert a["statusCode"] == 200 and a["headers"]["cache-control"].startswith("public")
    assert a["body"] == b["body"]
    doc = json.loads(a["body"])
    validate(doc)
    assert doc["state_id"] == "tension" and doc["parameterization"]["collection_delay_days"] == 16


def test_http_handler_rejects_out_of_range_with_400():
    r = handler({"rawQueryString": "paths=7", "queryStringParameters": {"paths": "7"}})
    assert r["statusCode"] == 400 and r["headers"]["cache-control"] == "no-store"


def test_invoke_handler_returns_engine_result_or_state(profile_dict):
    payload = request_from_query({"collection_delay_days": "16", "paths": "500"}, profile_dict)
    payload["cutoff_date"] = "2026-09-12"
    result = handler(payload)
    assert result["status"] == "ok" and "breaking_points" in result
    state = handler({**payload, "format": "state"})
    validate(state)


def test_money_is_integer_cents_everywhere():
    doc = json.loads((ROOT / "fixtures" / "states" / "tension.json").read_text())

    def walk(node, path=""):
        if isinstance(node, dict):
            for k, v in node.items():
                if k.endswith("_cents") and v is not None:
                    assert isinstance(v, int), f"{path}.{k} is not integer cents"
                walk(v, f"{path}.{k}")
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}[{i}]")

    walk(doc)
