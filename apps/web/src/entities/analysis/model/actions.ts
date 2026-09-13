// The action catalogue, contracts/actions.schema.json.
//
// The form is generated from this file; it is not hand-written per decision.
// Adding a decision means adding a schema entry on the backend side -- no
// interface component changes (docs/architecture.md decision 7).
//
// It is imported at build time rather than fetched: Module B must still render
// its controls when the API is unreachable, which is the whole point of the
// degradation in PRD 5.5.
import schema from "@contracts/actions.schema.json";
import type { ActionKind } from "./types";

export type ParameterType =
  "money" | "percentage" | "days" | "integer" | "boolean";

/** A slider mark. The PRD thresholds -- the breaking point at 16 days, the
 *  minimum reinforcement at 25% -- live in the contract as data, so the
 *  interface shows them without hard-coding a documented figure. */
export interface ParameterMark {
  value: number;
  text: string;
}

export interface ParameterSpec {
  id: string;
  /** Spanish: the schema is where the language boundary sits. */
  label: string;
  type: ParameterType;
  min?: number;
  max?: number;
  default: number | boolean;
  step?: number;
  hint?: string;
  mark?: ParameterMark;
}

export interface ActionSpec {
  label: string;
  default?: boolean;
  hint?: string;
  parameters: ParameterSpec[];
}

interface ActionsSchema {
  schema: string;
  actions: Record<string, ActionSpec>;
  stress: { label: string; parameters: ParameterSpec[] };
  run: { parameters: ParameterSpec[] };
}

const catalogue = schema as unknown as ActionsSchema;

export const ACTIONS = catalogue.actions as Record<ActionKind, ActionSpec>;
export const STRESS_PARAMETERS = catalogue.stress.parameters;
export const RUN_PARAMETERS = catalogue.run.parameters;

/** The five decisions plus the current operation, in the order the contract
 *  declares them. */
export const ACTION_KINDS = Object.keys(ACTIONS) as ActionKind[];

/** The decision the contract marks as `"default": true`: the demo case the
 *  evaluation report backs. */
export const DEFAULT_ACTION: ActionKind =
  (ACTION_KINDS.find((kind) => ACTIONS[kind].default) as ActionKind) ??
  "accept_project";

export type ParameterValue = number | boolean;
export type ParameterValues = Record<string, ParameterValue>;

/** Every parameter of one decision at its declared default. */
export function defaultsFor(kind: ActionKind): ParameterValues {
  return fromSpecs(ACTIONS[kind]?.parameters ?? []);
}

export function defaultStress(): ParameterValues {
  return fromSpecs(STRESS_PARAMETERS);
}

export function defaultRun(): ParameterValues {
  return fromSpecs(RUN_PARAMETERS);
}

function fromSpecs(specs: ParameterSpec[]): ParameterValues {
  const values: ParameterValues = {};
  for (const spec of specs) values[spec.id] = spec.default;
  return values;
}

/** Clamps a value to the bounds the contract declares. Out-of-range values are
 *  rejected by the backend with a 400; clamping here keeps a slider from
 *  producing one in the first place. */
export function clampToSpec(spec: ParameterSpec, value: number): number {
  let clamped = value;
  if (typeof spec.min === "number") clamped = Math.max(spec.min, clamped);
  if (typeof spec.max === "number") clamped = Math.min(spec.max, clamped);
  return clamped;
}
