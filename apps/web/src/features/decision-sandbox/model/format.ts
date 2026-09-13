import type { ParameterSpec } from "@entities/analysis";
import { formatMoney } from "@shared";

/** Renders a parameter's current value in the unit its type declares.
 *
 *  The interface formats; it does not convert. Money arrives as integer cents
 *  and is divided by 100 only to be displayed, never to be sent back. */
export function formatValue(spec: ParameterSpec, value: number): string {
  switch (spec.type) {
    case "money":
      return formatMoney(value / 100);
    case "percentage":
      return `${round(value)}%`;
    case "days":
      return value === 1 ? "1 día" : `${value} días`;
    default:
      return String(value);
  }
}

/** Renders a slider mark's position as a percentage of its track. */
export function markOffset(spec: ParameterSpec, value: number): number {
  const min = spec.min ?? 0;
  const max = spec.max ?? 100;
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
