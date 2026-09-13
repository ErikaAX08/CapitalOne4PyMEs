export interface Business {
  id: string;
  name: string;
  owner: string;
  employees: number;
  balance: number;
  concentration: number;
}
/** The reconciliation states of `movements.status` in
 *  contracts/database/schema.sql. `settled` and `cancelled` no longer affect
 *  the cash calendar (docs/data-model.md §4). */
export type MovementStatus =
  "expected" | "confirmed" | "delayed" | "settled" | "cancelled";

/** Where the fact came from. `manual` is the one a person types in. */
export type MovementSource = "bank" | "cfdi" | "manual" | "rule" | "action";

/** How much of the figure is known rather than assumed. */
export type MovementProvenance =
  "known" | "declared" | "learned" | "hypothetical";

/** One dated receipt or obligation of the business: a row of the `movements`
 *  table (docs/data-model.md §3), as `GET /v1/movements` returns it.
 *
 *  Money is an integer count of cents on the wire, as it is in the database and
 *  in the engine contract; `formatMoney` is what turns it into pesos on screen.
 *  The Spanish the interface reads is built here, at the boundary — the
 *  contract itself stays English. */
export interface Movement {
  id: string;
  companyId: string;
  /** The capability the movement funds or consumes: `payroll`, `collection`,
   *  `supplier`… One of the twenty-four `graph_nodes`. */
  node: string;
  direction: "in" | "out";
  /** Contractual date, ISO-8601. */
  dueDate: string;
  amountCents: number;
  settledCents: number;
  status: MovementStatus;
  /** When the fact became knowable; never after the cut-off. */
  knownAt: string;
  source: MovementSource;
  sourceRef?: string;
  shift: "none" | "delivery" | "collection";
  scale: "none" | "sales" | "cost";
  exposure: "none" | "main_customer";
  provenance: MovementProvenance;
  description?: string;
}

/** What the interface posts to create one. Everything the schema defaults is
 *  omitted: node, direction, date and amount are the four a person supplies. */
export interface MovementDraft {
  node: string;
  direction: "in" | "out";
  dueDate: string;
  amountCents: number;
  description?: string;
}

export interface FinancialTransaction {
  id: string;
  date: string;
  amount: number;
  direction: "income" | "expense";
  category: string;
  merchant: string;
  status: "confirmed" | "expected" | "delayed";
  confidence: number;
}
