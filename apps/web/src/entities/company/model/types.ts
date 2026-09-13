/** The profile variables a caller may supply when the database does not hold
 *  them. They are the ids `GET /v1/analysis` accepts verbatim, so the contract
 *  stays English and the Spanish lives in the component. */
export type DeclarableVariable =
  | "opening_balance_cents"
  | "payroll_cents"
  | "main_customer_concentration"
  | "contracted_term_days"
  | "average_collection_days";

/** One row of the company catalogue, as `GET /v1/companies` returns it. */
export interface CompanySummary {
  companyId: string;
  name: string;
  vertical: string;
  /** The external reference set it came from; absent for the product's own. */
  dataset?: string;
  knownVariables: number;
  totalVariables: number;
  /** What must be declared before the analysis can answer for this company.
   *  It is what turns an abstention from a dead end into an instruction. */
  missing?: DeclarableVariable[];
  /** A recorded outcome, never a prediction. */
  bankrupt: boolean;
  openingBalanceCents?: number;
}

export interface CompanyCatalog {
  cutoffDate: string;
  /** The company the service analyses when none is chosen. */
  defaultCompany: string;
  companies: CompanySummary[];
}

/** What the person simulating supplies for the variables the database lacks.
 *  A value is in cents or in days, matching the contract; the form converts. */
export type DeclaredValues = Partial<Record<DeclarableVariable, number>>;

/** Whether the caller has supplied every variable this company lacks.
 *
 *  This is a completeness check on the form, NOT a prediction of abstention:
 *  the engine owns that rule and reports the coverage it actually saw. An
 *  earlier version recomputed the threshold here from the catalogue's
 *  `knownVariables`, which counts only the snapshot's columns — the engine also
 *  knows the payroll interval and the recurring calendar, so the two disagreed
 *  and the interface warned about an abstention while displaying a result. */
export function declarationComplete(
  company: CompanySummary,
  declared: DeclaredValues,
): boolean {
  return (company.missing ?? []).every((id) => declared[id] !== undefined);
}
