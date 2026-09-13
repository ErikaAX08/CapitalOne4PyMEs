// The state document, contracts/state.schema.json.
//
// Field names are English because the contract is the language boundary;
// `label`, `headline`, `explanation` and `notices` arrive in Spanish already
// composed. The front-end formats -- currency, percentages, Title Case -- it
// does not translate and it does not compute (PRD 5.3, rule 3).
//
// Money is an integer count of cents. Frequencies are numbers in [0, 1];
// `advance_pct` and the tension percentages are in [0, 100].

export type StateId = "stable" | "tension" | "crisis" | "abstention";
export type SurvivalState = Exclude<StateId, "abstention">;
export type ActionKind =
  | "none"
  | "accept_project"
  | "extend_credit"
  | "hire_staff"
  | "buy_asset"
  | "request_financing";
export type Stack =
  "finance" | "sales" | "operations" | "people" | "technology" | "compliance";
export type TensionFactorId =
  | "payroll_coverage"
  | "average_collection_period"
  | "collection_delay_tolerance"
  | "cost_increase_tolerance"
  | "sales_drop_tolerance"
  | "main_customer_concentration";
export type RangeSource =
  "documented" | "control_range" | "declared_assumption";

export interface Coverage {
  known_variables: number;
  total_variables: number;
  unknown_fraction: number;
}

/** Echo of what the engine actually ran: action kind, its parameters, and the
 *  three stress controls. Used to confirm a response matches the last request
 *  and to pick the nearest fallback. */
export interface Parameterization {
  action: ActionKind;
  collection_delay_days: number;
  main_customer_lost: boolean;
  capital_injection_cents: number;
  [parameter: string]: string | number | boolean;
}

export interface FirstObligation {
  kind: string;
  /** Spanish, Title Case: "Nómina". */
  label: string;
  day: number;
  date: string;
  /** Spanish long date: "26 de noviembre". */
  date_text: string;
  gap_cents: number;
}

export interface Survival {
  weeks: number;
  /** True when no gap appears within the horizon, so `weeks` is the bound the
   *  horizon allows us to assert -- rendered as "> 25". */
  upper_bounded: boolean;
  state: SurvivalState;
  state_label: string;
  /** Module A dynamic text; always names the concrete obligation. */
  headline: string;
  net_recurring_flow_cents?: number;
  first_obligation: FirstObligation | null;
}

export interface Simulation {
  event: "uncovered_obligation";
  horizon_days: number;
  paths: number;
  gap_frequency: number;
  /** Share of futures whose first uncovered obligation falls within 30/60/90 days. */
  gap_frequency_by_horizon: Record<string, number>;
  ci95: [number, number];
  mean_gap_cents: number;
  p95_gap_cents: number;
}

/** One bar of Module C. It travels with the margin and range it was computed
 *  from, in exactly one unit, so the tooltip can show the computation. */
export interface TensionFactor {
  factor: TensionFactorId;
  stack: Stack;
  stack_label: string;
  label: string;
  tension: number;
  range_source: RangeSource;
  margin_cents?: number;
  range_cents?: number;
  margin_days?: number;
  range_days?: number;
  margin_pp?: number;
  range_pp?: number;
  margin?: number;
  range?: number;
  /** True when no perturbation on the search grid opened a gap. */
  search_bounded?: boolean;
}

export interface PropagationPath {
  nodes: string[];
  node_labels: Record<string, string>;
  origin_node: string;
  breaking_node: string | null;
}

export interface ReinforcementBefore {
  gap_frequency: number;
  weeks: number;
  upper_bounded: boolean;
  state: SurvivalState;
  state_label: string;
}

export interface MinimumReinforcement {
  kind: "advance" | "capital_injection";
  /** Module D recommended action, Spanish. */
  label: string;
  percentage: number | null;
  amount_cents: number | null;
  additional_percentage?: number;
  /** False when the Wilson upper bound is already at or under 5%. */
  required: boolean;
  /** False when the grid was exhausted without closing the gap. */
  found?: boolean;
  before: ReinforcementBefore;
  state_label_after: string | null;
  gap_frequency_after?: number;
  ci95_after?: number[];
  weeks_after?: number;
  upper_bounded_after?: boolean;
  state_after?: SurvivalState;
  grid_points_evaluated?: number;
}

/** One Module E chip: the Spanish label for a warning code. */
export interface Notice {
  code: string;
  label: string;
}

export interface StateDocument {
  schema: "v1";
  state_id: StateId;
  state_label: string;
  company_id: string;
  cutoff_date: string;
  currency: "MXN";
  seed: number;
  engine_version: string;
  horizon_days: number;
  coverage: Coverage;
  parameterization: Parameterization | null;
  survival: Survival | null;
  simulation: Simulation | null;
  tension: TensionFactor[];
  propagation_path: PropagationPath | null;
  minimum_reinforcement: MinimumReinforcement | null;
  explanation: string;
  warnings: string[];
  notices: Notice[];
  definitions: Record<string, string> & {
    survival_weeks: string;
    tension: string;
    gap_frequency: string;
  };
}

/** The version this front-end knows how to render. An unknown schema is a
 *  visible failure, never a silent zero (PRD 5.3, rule 5). */
export const SUPPORTED_SCHEMA = "v1";

/** Narrows an unknown payload to a state document, checking the version first. */
export function isStateDocument(value: unknown): value is StateDocument {
  if (typeof value !== "object" || value === null) return false;
  const document = value as Partial<StateDocument>;
  return (
    document.schema === SUPPORTED_SCHEMA &&
    typeof document.state_id === "string" &&
    Array.isArray(document.tension) &&
    Array.isArray(document.warnings) &&
    Array.isArray(document.notices) &&
    typeof document.explanation === "string"
  );
}
