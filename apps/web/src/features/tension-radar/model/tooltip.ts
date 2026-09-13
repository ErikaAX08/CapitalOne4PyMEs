import type { TensionFactor } from "@entities/analysis";
import { formatMoney } from "@shared";

/** The computation behind one bar, in the unit the factor travels in.
 *
 *  Module C's bars are only defensible because each one carries the margin and
 *  range it was computed from. Without this line the bar is an assertion; with
 *  it, a reviewer can redo the arithmetic. */
export function computationText(factor: TensionFactor): string {
  const pair = marginAndRange(factor);
  if (!pair) return "Margen y rango no disponibles.";
  return `Tensión = 1 − (${pair.margin} ÷ ${pair.range})`;
}

function marginAndRange(
  factor: TensionFactor,
): { margin: string; range: string } | null {
  if (
    typeof factor.margin_cents === "number" &&
    typeof factor.range_cents === "number"
  ) {
    return {
      margin: formatMoney(factor.margin_cents / 100),
      range: formatMoney(factor.range_cents / 100),
    };
  }
  if (
    typeof factor.margin_days === "number" &&
    typeof factor.range_days === "number"
  ) {
    return {
      margin: `${factor.margin_days} días`,
      range: `${factor.range_days} días`,
    };
  }
  if (
    typeof factor.margin_pp === "number" &&
    typeof factor.range_pp === "number"
  ) {
    return {
      margin: `${factor.margin_pp} pp`,
      range: `${factor.range_pp} pp`,
    };
  }
  if (typeof factor.margin === "number" && typeof factor.range === "number") {
    return { margin: factor.margin.toFixed(2), range: factor.range.toFixed(2) };
  }
  return null;
}

/** The two ranges the PRD marks as declared assumptions must say so on screen:
 *  they are assumptions, not measurements, exactly as the evaluation report
 *  declares its own. */
export function sourceNote(factor: TensionFactor): string | null {
  switch (factor.range_source) {
    case "declared_assumption":
      return "Supuesto declarado";
    case "control_range":
      return "Rango de control";
    default:
      return null;
  }
}

/** Bar colour by load, cool through warm. No yellows: no token used here has a
 *  hue between 40 and 75 degrees (PRD 4.2). */
export function barColor(tension: number): string {
  if (tension >= 0.85) return "bg-danger";
  if (tension >= 0.6) return "bg-tension";
  if (tension >= 0.35) return "bg-chart-2";
  return "bg-brand-blue";
}
