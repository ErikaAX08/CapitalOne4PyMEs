#!/usr/bin/env python3
"""Phase 0: validate the engine against the evaluation report, then generate the
fallback state documents and golden fixtures.

Usage, from services/engine:

    python scripts/generate_states.py --seed 42 --paths 5000 [--check]

Step 1 — Validate. Runs the report protocol (20,000 futures, search seed 781,
verification seed 782, zero delay) and asserts the documented figures: 0.0%,
46.9%, 25.6%, 4.6%, breaking point 16 days, payroll on day 75, $40,000.

Step 2 — Generate. Runs the four PRD parameterizations at the requested seed and
writes them to apps/web/public/states/ and to fixtures/states/. Figures come
from the run, never from step 1: the report is at zero delay, the states carry
sixteen days.

`--check` regenerates in memory and fails if any file differs byte for byte:
the CI `data` gate.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from engine.actions import Action
from engine.analysis import EngineRequest, analyze
from engine.cash.profile import CompanyProfile, base_calendar
from engine.contracts import request_from_query
from engine.projection import to_state_document
from engine.simulation import simulate, summarize, worlds
from engine.stress import Stress

REPO = ROOT.parents[1]
PROFILE = json.loads((ROOT / "fixtures" / "company_demo_agency.json").read_text())
WEB_STATES = REPO / "apps" / "web" / "public" / "states"
FIXTURE_STATES = ROOT / "fixtures" / "states"
CUTOFF = date(2026, 9, 12)

# PRD §5.4 — four parameterizations, not four actions.
STATES = {
    "base": {"action": "none"},
    "tension": {"action": "accept_project", "collection_delay_days": "16"},
    "crisis": {
        "action": "accept_project",
        "collection_delay_days": "16",
        "main_customer_lost": "true",
    },
    "reinforced": {"action": "accept_project", "collection_delay_days": "16", "advance_pct": "25"},
}

# docs/evaluation-report.md §3 — verification worlds, 20,000 futures, zero delay.
REPORT = {
    "base": (Action("none"), 0.000),
    "project_without_reinforcement": (
        Action(
            "accept_project",
            dict(
                total_revenue_cents=80000000,
                initial_cost_cents=38000000,
                advance_pct=0,
                collection_days=60,
                hires=2,
            ),
        ),
        0.469,
    ),
    "milestones_not_modelled": None,
    "minimum_advance": (
        Action(
            "accept_project",
            dict(
                total_revenue_cents=80000000,
                initial_cost_cents=38000000,
                advance_pct=25,
                collection_days=60,
                hires=2,
            ),
        ),
        0.046,
    ),
    "advance_20": (
        Action(
            "accept_project",
            dict(
                total_revenue_cents=80000000,
                initial_cost_cents=38000000,
                advance_pct=20,
                collection_days=60,
                hires=2,
            ),
        ),
        0.097,
    ),
    "advance_40": (
        Action(
            "accept_project",
            dict(
                total_revenue_cents=80000000,
                initial_cost_cents=38000000,
                advance_pct=40,
                collection_days=60,
                hires=2,
            ),
        ),
        0.003,
    ),
}


def validate() -> None:
    profile = CompanyProfile.from_dict(PROFILE)
    base = base_calendar(profile, 180)
    verify = worlds(20000, 782)
    print("Step 1 · validation against docs/evaluation-report.md §3 (20,000 futures, seed 782)")
    for name, spec in REPORT.items():
        if spec is None:
            continue
        action, expected = spec
        s = summarize(
            simulate(verify, base + action.movements(profile, 180), profile.opening_balance_cents)
        )
        ok = round(s["gap_frequency"], 3) == expected
        print(
            f"  {name:32s} {s['gap_frequency'] * 100:5.1f}%  expected {expected * 100:4.1f}%  {'OK' if ok else 'MISMATCH'}"
        )
        if not ok:
            raise SystemExit("validation failed: the engine no longer reproduces the report")
    result = analyze(
        EngineRequest(profile, REPORT["project_without_reinforcement"][0], Stress(), 20000, 781)
    )
    bp = result["breaking_points"]["collection_delay"]
    r = result["minimum_reinforcement"]
    checks = [
        ("breaking point 16 days", bp["additional_days"] == 16),
        (
            "first obligation payroll day 75",
            bp["first_node"] == "payroll" and bp["first_day"] == 75,
        ),
        ("gap $40,000", bp["gap_cents"] == 4_000_000),
        (
            "minimum advance 25% on search seed 781",
            r["kind"] == "advance" and r["percentage"] == 25.0,
        ),
        ("verified gap frequency 4.6%", round(r["gap_frequency_after"], 3) == 0.046),
        ("sales drop tolerance 10 pp", result["breaking_points"]["sales_drop"]["drop_pp"] == 10.0),
        (
            "cost increase tolerance 7 pp",
            result["breaking_points"]["cost_increase"]["increase_pp"] == 7.0,
        ),
    ]
    for label, ok in checks:
        print(f"  {label:48s} {'OK' if ok else 'MISMATCH'}")
        if not ok:
            raise SystemExit("validation failed: " + label)


def generate(seed: int, paths: int) -> dict[str, str]:
    print(f"Step 2 · generating fallback states (seed {seed}, {paths} futures, cut-off {CUTOFF})")
    documents: dict[str, str] = {}
    for name, query in STATES.items():
        payload = request_from_query({**query, "seed": str(seed), "paths": str(paths)}, PROFILE)
        request = EngineRequest.from_dict(payload)
        state = to_state_document(analyze(request), request.profile.company_id, CUTOFF)
        documents[name] = json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        s = state["survival"]
        print(
            f"  {name:10s} state={state['state_id']:8s} weeks={s['weeks']:>2} "
            f"gap_frequency={state['simulation']['gap_frequency'] * 100:5.1f}%"
        )
    return documents


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--paths", type=int, default=5000)
    parser.add_argument("--check", action="store_true", help="fail if the files on disk differ")
    parser.add_argument("--skip-validation", action="store_true")
    args = parser.parse_args()
    if not args.skip_validation:
        validate()
    documents = generate(args.seed, args.paths)
    drift = []
    for name, text in documents.items():
        for directory in (WEB_STATES, FIXTURE_STATES):
            target = directory / f"{name}.json"
            if args.check:
                if not target.exists() or target.read_text(encoding="utf-8") != text:
                    drift.append(str(target))
            else:
                directory.mkdir(parents=True, exist_ok=True)
                target.write_text(text, encoding="utf-8")
    if args.check:
        if drift:
            raise SystemExit("fixtures drifted:\n  " + "\n  ".join(drift))
        print("fixtures reproduce byte for byte")
    else:
        print(f"written to {WEB_STATES} and {FIXTURE_STATES}")


if __name__ == "__main__":
    main()
