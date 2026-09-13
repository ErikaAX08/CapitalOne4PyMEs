"""Access to the shared contracts under `contracts/` and query-string parsing.

The engine never hard-codes a parameter default or bound: both come from
`actions.schema.json`, the same file the front-end generates its form from and
the Go domain validates against.
"""

from __future__ import annotations

import json
import os
from functools import cache
from pathlib import Path
from typing import Any

from engine.errors import ParameterError

_CANDIDATES = [
    os.environ.get("ENGINE_CONTRACTS_DIR"),
    str(Path(__file__).resolve().parents[1] / "contracts"),  # Lambda zip layout
    str(Path(__file__).resolve().parents[3] / "contracts"),  # repository layout
]


def contracts_dir() -> Path:
    for candidate in _CANDIDATES:
        if candidate and (Path(candidate) / "actions.schema.json").exists():
            return Path(candidate)
    raise FileNotFoundError("contracts directory not found; set ENGINE_CONTRACTS_DIR")


@cache
def load(name: str) -> dict[str, Any]:
    return json.loads((contracts_dir() / name).read_text(encoding="utf-8"))


def actions_schema() -> dict[str, Any]:
    return load("actions.schema.json")


def state_schema() -> dict[str, Any]:
    return load("state.schema.json")


def _coerce(spec: dict[str, Any], raw: str | None) -> Any:
    if raw is None or raw == "":
        return spec["default"]
    kind = spec["type"]
    try:
        if kind in ("money", "days", "integer"):
            value: Any = int(raw)
        elif kind == "percentage":
            value = float(raw)
        elif kind == "boolean":
            if raw.lower() not in ("true", "false", "1", "0"):
                raise ValueError(raw)
            return raw.lower() in ("true", "1")
        else:
            value = raw
    except ValueError as exc:
        raise ParameterError(f"{spec['id']}: {raw!r} is not a valid {kind}") from exc
    if "min" in spec and value < spec["min"] or "max" in spec and value > spec["max"]:
        raise ParameterError(
            f"{spec['id']}: {value} outside [{spec.get('min')}, {spec.get('max')}]"
        )
    return value


def request_from_query(query: dict[str, str], company: dict[str, Any]) -> dict[str, Any]:
    """Build an engine request from `GET /v1/analysis` query parameters."""
    schema = actions_schema()
    kind = query.get("action", "accept_project")
    if kind not in schema["actions"]:
        raise ParameterError(f"unknown action: {kind}")
    parameters = {
        p["id"]: _coerce(p, query.get(p["id"])) for p in schema["actions"][kind]["parameters"]
    }
    stress = {p["id"]: _coerce(p, query.get(p["id"])) for p in schema["stress"]["parameters"]}
    run = {p["id"]: _coerce(p, query.get(p["id"])) for p in schema["run"]["parameters"]}
    return {
        "schema": "engine-request/v1",
        "company": company,
        "action": {"kind": kind, "parameters": parameters},
        "stress": stress,
        **run,
    }
