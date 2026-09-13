"""Projection of an engine result into the state document (`contracts/state.schema.json`).

This is the language boundary: field names stay English, `label` values and the
explanation are Spanish because they are rendered to the user. In the target
architecture the Go `risk` context owns this projection; the engine ships it so
phase 0 can generate the fallback states and the API can answer before Go exists.
Both must produce the same document, which the contract test enforces.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from engine import SCHEMA_VERSION

FACTOR_LABELS = {
    "payroll_coverage": "Cobertura De Nómina",
    "average_collection_period": "Plazo Promedio De Cobro",
    "collection_delay_tolerance": "Retraso En Cobranza",
    "cost_increase_tolerance": "Incremento De Costos",
    "sales_drop_tolerance": "Caída De Ventas",
    "main_customer_concentration": "Concentración De Clientes",
}

OBLIGATION_LABELS = {
    "payroll": "la nómina",
    "supplier": "el pago a proveedores",
    "debt": "el servicio de deuda",
    "tax": "el pago de impuestos",
    "materials": "el pago de materiales",
    "hiring": "el costo del personal del proyecto",
    "collection": "la venta a crédito",
}

BASE_WARNINGS = [
    "synthetic_assumptions",
    "no_mexico_validation",
    "declared_reference_range",
    "monte_carlo_excludes_distribution_error",
]

# Spanish copy for every code the interface renders. The contract is the language
# boundary: the front-end formats, it does not translate.
WARNING_LABELS = {
    "synthetic_assumptions": "Escenario sintético en MXN",
    "no_mexico_validation": "Sin validación en población mexicana",
    "declared_reference_range": "Dos rangos de referencia son supuestos declarados",
    "monte_carlo_excludes_distribution_error": (
        "Los intervalos Monte Carlo no cubren el error de distribución"
    ),
    "insufficient_data_coverage": "Cobertura de datos insuficiente",
    "collection_beyond_horizon": "El cobro cae fuera del horizonte",
    "no_reinforcement_within_grid": "Ningún refuerzo en el rango evaluado elimina la brecha",
    "reinforcement_grid_is_capital_injection": "Refuerzo evaluado como inyección de capital",
    "tolerance_beyond_search_range": "Alguna tolerancia excede el rango de búsqueda",
}

STATE_LABELS = {
    "stable": "Estable",
    "tension": "Tensión",
    "crisis": "Crisis Estructural",
    "abstention": "Sin Estimación",
}

STACK_LABELS = {
    "finance": "Finanzas",
    "sales": "Ventas",
    "operations": "Operaciones",
    "people": "Personas",
    "technology": "Tecnología",
    "compliance": "Cumplimiento",
}

NODE_LABELS = {
    "delivery": "Entrega",
    "invoice": "Factura",
    "collection": "Cobro",
    "cash": "Efectivo",
    "payroll": "Nómina",
    "supplier": "Proveedores",
    "customer": "Cliente Principal",
    "sales": "Ventas",
    "materials": "Materiales",
    "hiring": "Contratación",
    "credit": "Crédito",
    "debt": "Deuda",
    "tax": "Impuestos",
}

OBLIGATION_TITLES = {
    "payroll": "Nómina",
    "supplier": "Pago A Proveedores",
    "debt": "Servicio De Deuda",
    "tax": "Impuestos",
    "materials": "Materiales",
    "hiring": "Personal Del Proyecto",
    "collection": "Venta A Crédito",
}

DEFINITIONS = {
    "survival_weeks": (
        "Semanas completas entre la fecha de corte y la primera obligación que queda "
        "descubierta, sobre la ruta determinista del escenario evaluado y sin choque "
        "aleatorio. Si no aparece brecha en el horizonte, se reporta la cota que el "
        "horizonte permite afirmar."
    ),
    "tension": (
        "Tensión = 1 − (margen disponible ÷ rango de referencia), acotada a [0, 1]. Es una "
        "normalización de tolerancias univariadas, no una atribución causal aprendida. Los "
        "rangos marcados como supuesto declarado son supuestos, no mediciones."
    ),
    "gap_frequency": (
        "Proporción de futuros simulados en los que alguna obligación queda descubierta "
        "dentro del horizonte. Condicionada a los supuestos del escenario; no es una "
        "probabilidad calibrada."
    ),
}


def _headline(survival: dict[str, Any], action_kind: str, horizon: int) -> str:
    """Module A dynamic text (PRD §3.1). Always names the concrete obligation."""
    first = survival["first_obligation"]
    if first is None:
        if action_kind == "none":
            return (
                "Operación actual, sin el proyecto en evaluación. Introduce una decisión "
                "para ver su efecto."
            )
        return f"Ninguna obligación queda descubierta en el horizonte de {horizon} días."
    name = OBLIGATION_LABELS.get(first["kind"], "la obligación").capitalize()
    amount = format_mxn(first["gap_cents"])
    if survival["state"] == "crisis":
        return f"{name} del día {first['day']} queda descubierta por {amount}. Se requiere acción."
    return (
        f"{name} del {first['date_text']} queda descubierta por {amount}. Hay margen para reforzar."
    )


def _date_text(iso: str) -> str:
    months = [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre",
    ]
    y, m, d = (int(x) for x in iso.split("-"))
    return f"{d} de {months[m - 1]}"


def _reinforcement_label(r: dict[str, Any] | None) -> str | None:
    if r is None:
        return None
    if r.get("amount_cents") is None:
        return "Ningún refuerzo dentro del rango evaluado"
    if not r.get("required"):
        return "No se requiere refuerzo: la frecuencia de brecha ya está bajo el 5%"
    if r["kind"] == "advance":
        return f"Solicitar un anticipo de {r['percentage']:.0f}% ({format_mxn(r['amount_cents'])})"
    return f"Inyectar capital de trabajo por {format_mxn(r['amount_cents'])}"


def format_mxn(cents: int) -> str:
    pesos = abs(cents) / 100
    text = f"${pesos:,.0f}" if pesos >= 1000 else f"${pesos:,.2f}"
    return ("-" if cents < 0 else "") + text


def _date(cutoff: date, day: int) -> str:
    return (cutoff + timedelta(days=day)).isoformat()


def _explanation(result: dict[str, Any], horizon: int) -> str:
    survival = result["survival"]
    first = survival["first_obligation"]
    action = result["action"]["kind"]
    r = result.get("minimum_reinforcement")
    if first is None:
        if action == "none":
            return (
                "Operación actual, sin la decisión en evaluación. Ninguna obligación queda "
                f"descubierta en el horizonte de {horizon} días."
            )
        text = f"Ninguna obligación queda descubierta en el horizonte de {horizon} días."
        sim = result["simulation"]
        if r and r.get("required") and r.get("amount_cents"):
            name = (
                f"un anticipo de {r['percentage']:.0f}% ({format_mxn(r['amount_cents'])})"
                if r["kind"] == "advance"
                else f"una inyección de capital de {format_mxn(r['amount_cents'])}"
            )
            text += (
                f" Aun así, en {sim['gap_frequency'] * 100:.1f}% de {sim['paths']:,} futuros "
                f"simulados aparece una brecha; {name} la reduce a "
                f"{r['gap_frequency_after'] * 100:.1f}%."
            )
        return text
    obligation = OBLIGATION_LABELS.get(first["kind"], "la obligación")
    stress = result["stress"]
    parts: list[str] = []
    collection = result.get("effective_collection_days") or {}
    if stress["main_customer_lost"]:
        parts.append("Sin el cliente principal, los cobros base ya no sostienen la operación.")
    if "project.collection" in collection:
        day = collection["project.collection"]
        if day > horizon:
            parts.append(f"El cobro del proyecto llega después del horizonte de {horizon} días.")
        elif day > first["day"]:
            parts.append(
                f"El cobro llega el día {day}, después de {obligation} del día {first['day']}."
            )
        else:
            parts.append(f"{obligation.capitalize()} del día {first['day']} queda descubierta.")
    elif "credit.deferred_collection" in collection:
        day = collection["credit.deferred_collection"]
        parts.append(
            f"El cobro diferido llega el día {day}, después de {obligation} del día {first['day']}."
        )
    else:
        parts.append(f"{obligation.capitalize()} del día {first['day']} queda descubierta.")
    parts.append(f"Faltan {format_mxn(first['gap_cents'])}.")
    if r and r.get("amount_cents") is not None:
        if r["kind"] == "advance":
            name = f"Un anticipo de {r['percentage']:.0f}% ({format_mxn(r['amount_cents'])})"
        else:
            name = f"Una inyección de capital de {format_mxn(r['amount_cents'])}"
        if r["state_after"] == "stable":
            parts.append(f"{name} elimina esta brecha en este escenario.")
        else:
            parts.append(
                f"{name} reduce la frecuencia de brecha de "
                f"{result['simulation']['gap_frequency'] * 100:.1f}% a "
                f"{r['gap_frequency_after'] * 100:.1f}%, sin eliminarla."
            )
    elif r and r.get("found") is False:
        parts.append("Ningún refuerzo dentro del rango evaluado elimina esta brecha.")
    return " ".join(parts)


def _warnings(result: dict[str, Any], horizon: int) -> list[str]:
    warnings = list(BASE_WARNINGS)
    collection = result.get("effective_collection_days") or {}
    if any(day > horizon for day in collection.values()):
        warnings.append("collection_beyond_horizon")
    r = result.get("minimum_reinforcement")
    if r and r.get("found") is False:
        warnings.append("no_reinforcement_within_grid")
    if r and r.get("kind") == "capital_injection":
        warnings.append("reinforcement_grid_is_capital_injection")
    if any(f.get("search_bounded") for f in result["tension"]):
        warnings.append("tolerance_beyond_search_range")
    return warnings


def to_state_document(
    result: dict[str, Any], company_id: str, cutoff_date: date, currency: str = "MXN"
) -> dict[str, Any]:
    horizon = result["horizon_days"]
    head = {
        "schema": SCHEMA_VERSION,
        "company_id": company_id,
        "cutoff_date": cutoff_date.isoformat(),
        "currency": currency,
        "seed": result["seed"],
        "engine_version": result["engine_version"],
        "horizon_days": horizon,
        "coverage": result["coverage"],
    }
    if result["status"] == "abstention":
        return {
            **head,
            "state_id": "abstention",
            "parameterization": None,
            "survival": None,
            "simulation": None,
            "tension": [],
            "propagation_path": None,
            "minimum_reinforcement": None,
            "explanation": "Cobertura de datos insuficiente. No se emite estimación.",
            "warnings": BASE_WARNINGS + ["insufficient_data_coverage"],
            "notices": [
                {"code": c, "label": WARNING_LABELS[c]}
                for c in BASE_WARNINGS + ["insufficient_data_coverage"]
            ],
            "definitions": DEFINITIONS,
            "state_label": STATE_LABELS["abstention"],
        }

    survival = dict(result["survival"])
    first = survival.get("first_obligation")
    if first:
        iso = _date(cutoff_date, first["day"])
        survival["first_obligation"] = {
            **first,
            "date": iso,
            "date_text": _date_text(iso),
            "label": OBLIGATION_TITLES.get(first["kind"], first["kind"]),
        }
    sim = result["simulation"]
    reinforcement = result.get("minimum_reinforcement")
    if reinforcement is not None:
        reinforcement = {
            **reinforcement,
            "label": _reinforcement_label(reinforcement),
            "before": {
                "gap_frequency": sim["gap_frequency"],
                "weeks": survival["weeks"],
                "upper_bounded": survival["upper_bounded"],
                "state": survival["state"],
                "state_label": STATE_LABELS[survival["state"]],
            },
            "state_label_after": (
                STATE_LABELS[reinforcement["state_after"]]
                if reinforcement.get("state_after")
                else None
            ),
        }
    path = result["propagation_path"]
    warnings = _warnings(result, horizon)
    return {
        **head,
        "state_id": survival["state"],
        "state_label": STATE_LABELS[survival["state"]],
        "parameterization": {
            "action": result["action"]["kind"],
            **result["action"]["parameters"],
            **result["stress"],
        },
        "survival": {
            **{
                k: survival[k]
                for k in (
                    "weeks",
                    "upper_bounded",
                    "state",
                    "first_obligation",
                    "net_recurring_flow_cents",
                )
            },
            "state_label": STATE_LABELS[survival["state"]],
            "headline": _headline(survival, result["action"]["kind"], horizon),
        },
        "simulation": {
            "event": sim["event"],
            "horizon_days": horizon,
            "paths": sim["paths"],
            "gap_frequency": sim["gap_frequency"],
            "gap_frequency_by_horizon": sim["gap_frequency_by_horizon"],
            "ci95": sim["ci95"],
            "mean_gap_cents": sim["mean_gap_cents"],
            "p95_gap_cents": sim["p95_gap_cents"],
        },
        "tension": [
            {**f, "label": FACTOR_LABELS[f["factor"]], "stack_label": STACK_LABELS[f["stack"]]}
            for f in result["tension"]
        ],
        "propagation_path": {
            **path,
            "node_labels": {n: NODE_LABELS.get(n, n) for n in path["nodes"]},
        },
        "minimum_reinforcement": reinforcement,
        "explanation": _explanation(result, horizon),
        "warnings": warnings,
        "notices": [{"code": c, "label": WARNING_LABELS.get(c, c)} for c in warnings],
        "definitions": DEFINITIONS,
    }
