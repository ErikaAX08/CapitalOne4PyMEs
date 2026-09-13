import type { StateId, SurvivalState } from "@entities/analysis";

/** Colour by state, from cool for a sound structure to warm for a broken one.
 *
 *  The palette is the Capital One scale already in use, and no token in it has
 *  a hue between 40 and 75 degrees: the PRD forbids yellows in any component,
 *  metric or alert. */
export interface StateTone {
  bar: string;
  text: string;
  chip: string;
}

const TONES: Record<StateId, StateTone> = {
  stable: {
    bar: "bg-brand-blue",
    text: "text-brand-blue",
    chip: "border-brand-blue/15 bg-brand-blue-soft text-brand-blue",
  },
  tension: {
    bar: "bg-tension",
    text: "text-warning",
    chip: "border-tension/25 bg-tension-soft text-warning",
  },
  crisis: {
    bar: "bg-danger",
    text: "text-danger",
    chip: "border-danger/15 bg-danger-soft text-danger",
  },
  abstention: {
    bar: "bg-hairline-strong",
    text: "text-body-subtle",
    chip: "border-hairline bg-surface-subtle text-body",
  },
};

export function toneFor(state: StateId | SurvivalState): StateTone {
  return TONES[state as StateId] ?? TONES.abstention;
}

/** "> 25" when the horizon bounded the answer, "10" when a gap was found.
 *
 *  The prefix is not decoration: an unbounded count would claim the business
 *  survives exactly that long, when all the horizon supports is a lower bound. */
export function weeksText(weeks: number, upperBounded: boolean): string {
  return upperBounded ? `> ${weeks}` : String(weeks);
}
