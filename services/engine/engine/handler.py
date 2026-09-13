"""AWS Lambda entry point.

Two invocation shapes:

1. `lambda:Invoke` from the Go domain with an engine request
   (`contracts/engine-request.schema.json`). Returns the engine result; Go
   projects it into the state document. Add `"format": "state"` to receive the
   projected document instead.
2. API Gateway HTTP API v2 event (`GET /v1/analysis?...`). Returns the state
   document with a public cache header, so the API is usable before the Go
   domain is deployed. The response is a pure function of the query string.

Module-scope state (the demo profile) is loaded once per container.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import date
from pathlib import Path
from typing import Any

from engine.analysis import EngineRequest, analyze
from engine.contracts import request_from_query
from engine.errors import DataQualityError, ParameterError
from engine.projection import to_state_document

log = logging.getLogger("engine")
log.setLevel(logging.INFO)

_PROFILE_PATH = Path(
    os.environ.get(
        "ENGINE_COMPANY_PROFILE",
        Path(__file__).resolve().parents[1] / "fixtures" / "company_demo_agency.json",
    )
)
DEMO_PROFILE: dict[str, Any] = json.loads(_PROFILE_PATH.read_text(encoding="utf-8"))
CACHE_CONTROL = os.environ.get("ENGINE_CACHE_CONTROL", "public, max-age=3600")


def run_request(payload: dict[str, Any], cutoff: date | None = None) -> tuple[dict, dict]:
    """Returns (engine result, state document)."""
    request = EngineRequest.from_dict(payload)
    result = analyze(request)
    cutoff = cutoff or date.fromisoformat(payload.get("cutoff_date", date.today().isoformat()))
    state = to_state_document(result, request.profile.company_id, cutoff, request.profile.currency)
    return result, state


def _http(status: int, body: dict[str, Any], cache: bool) -> dict[str, Any]:
    headers = {"content-type": "application/json; charset=utf-8"}
    headers["cache-control"] = CACHE_CONTROL if cache else "no-store"
    return {"statusCode": status, "headers": headers, "body": json.dumps(body, ensure_ascii=False)}


def handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    correlation_id = (event.get("headers") or {}).get("x-correlation-id") or event.get(
        "correlation_id"
    )
    if "rawQueryString" in event or "queryStringParameters" in event:
        query = event.get("queryStringParameters") or {}
        try:
            payload = request_from_query(query, DEMO_PROFILE)
            payload["cutoff_date"] = query.get(
                "cutoff_date", os.environ.get("ENGINE_CUTOFF_DATE", "2026-09-12")
            )
            _, state = run_request(payload)
            log.info(
                json.dumps(
                    {
                        "correlation_id": correlation_id,
                        "state_id": state["state_id"],
                        "action": payload["action"]["kind"],
                        "seed": payload["seed"],
                    }
                )
            )
            return _http(200, state, cache=True)
        except (ParameterError, DataQualityError, ValueError) as exc:
            return _http(400, {"error": type(exc).__name__, "message": str(exc)}, cache=False)
    try:
        result, state = run_request(event)
    except (ParameterError, DataQualityError, ValueError) as exc:
        return {"status": "error", "error": type(exc).__name__, "message": str(exc)}
    log.info(json.dumps({"correlation_id": correlation_id, "status": result["status"]}))
    return state if event.get("format") == "state" else result
