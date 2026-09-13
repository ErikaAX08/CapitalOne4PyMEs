import type { AnalysisRequest } from "./query";
import type { Parameterization, StateDocument } from "./types";

/** How far apart two parameterizations are, on axes normalised by the range the
 *  contract declares for each control. Used to pick which precomputed state to
 *  show when the API cannot answer.
 *
 *  A different decision is not a near miss of any distance, so it dominates
 *  every other axis. */
const DIFFERENT_ACTION_PENALTY = 100;

const AXES: { id: string; range: number }[] = [
  { id: "collection_delay_days", range: 60 },
  { id: "capital_injection_cents", range: 40_000_000 },
  { id: "advance_pct", range: 60 },
];

function numeric(source: Parameterization, id: string): number {
  const value = source[id];
  return typeof value === "number" ? value : 0;
}

export function distance(
  candidate: Parameterization,
  request: AnalysisRequest,
): number {
  const wanted: Parameterization = {
    action: request.action,
    collection_delay_days: 0,
    main_customer_lost: false,
    capital_injection_cents: 0,
    ...request.parameters,
    ...request.stress,
  } as Parameterization;

  let total =
    candidate.action === request.action ? 0 : DIFFERENT_ACTION_PENALTY;
  if (
    Boolean(candidate.main_customer_lost) !== Boolean(wanted.main_customer_lost)
  ) {
    total += 1;
  }
  for (const axis of AXES) {
    total +=
      Math.abs(numeric(candidate, axis.id) - numeric(wanted, axis.id)) /
      axis.range;
  }
  return total;
}

/** The precomputed state closest to what was asked for.
 *
 *  The fallback does not invent: it shows a real state document that a real
 *  engine run produced, and the interface declares it as approximate. That is
 *  preferable to a blank screen, and it is only honest because the four
 *  documents are regenerated from the engine on every build. */
export function nearestFallback(
  candidates: StateDocument[],
  request: AnalysisRequest,
): StateDocument | null {
  let best: StateDocument | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (!candidate.parameterization) continue;
    const d = distance(candidate.parameterization, request);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best ?? candidates[0] ?? null;
}
