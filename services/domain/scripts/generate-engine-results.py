#!/usr/bin/env python3
"""Capture the engine results the Go projector is tested against.

The four parameterizations are PRD §5.4's, the same ones
services/engine/scripts/generate_states.py projects into the fallback states.
Committing the raw results lets the Go golden test run without Python; the
end-to-end test exercises the live engine instead.

Usage, from services/domain:

    python3 scripts/generate-engine-results.py
"""

from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
ENGINE = ROOT / "engine"
sys.path.insert(0, str(ENGINE))

from engine.analysis import EngineRequest, analyze  # noqa: E402
from engine.contracts import request_from_query  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parents[1] / (
    "internal/risk/adapters/projection/testdata"
)
PROFILE = json.loads((ENGINE / "fixtures" / "company_demo_agency.json").read_text())

STATES = {
    "base": {"action": "none"},
    "tension": {"action": "accept_project", "collection_delay_days": "16"},
    "crisis": {
        "action": "accept_project",
        "collection_delay_days": "16",
        "main_customer_lost": "true",
    },
    "reinforced": {
        "action": "accept_project",
        "collection_delay_days": "16",
        "advance_pct": "25",
    },
}

OUT.mkdir(parents=True, exist_ok=True)
for name, query in STATES.items():
    payload = request_from_query({**query, "seed": "42", "paths": "5000"}, PROFILE)
    result = analyze(EngineRequest.from_dict(payload))
    text = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    (OUT / f"{name}.result.json").write_text(text, encoding="utf-8")
    print(f"  {name:10s} status={result['status']}")
print(f"written to {OUT}")
