import type { Movement } from "../model/types";

/** The ledger the interface falls back to when the database cannot answer.
 *
 *  These are real rows in the shape `GET /v1/movements` returns, derived from
 *  the same demo business as the rest of the simulation: they are declared as
 *  approximate on screen, never passed off as the company's live ledger. The
 *  cut-off is 2026-09-12, so no `knownAt` is later than that. */
const CUTOFF = "2026-09-12";

/** Amounts are cents, as in the database and the engine contract. */
export const movementFixtures: Movement[] = [
  row("collection", "in", "2026-09-20", 16_000_000, "Comercial Atlas", {
    shift: "collection",
    scale: "sales",
    exposure: "main_customer",
    status: "confirmed",
  }),
  row("payroll", "out", "2026-09-18", 7_200_000, "Nómina quincenal"),
  row("supplier", "out", "2026-09-17", 9_500_000, "Suministros MX", {
    scale: "cost",
  }),
  row("collection", "in", "2026-09-16", 6_800_000, "Mercado del Sol", {
    shift: "collection",
    scale: "sales",
  }),
  row("capacity", "out", "2026-09-15", 2_400_000, "Renta de bodega"),
  row("tax", "out", "2026-09-14", 1_800_000, "Obligaciones fiscales"),
  row("debt", "out", "2026-09-13", 3_100_000, "Financiera local"),
  row("materials", "out", "2026-09-10", 1_250_000, "Logística Luna", {
    status: "settled",
    settledCents: 1_250_000,
  }),
  row("collection", "in", "2026-09-08", 4_300_000, "Distribuidora Sur", {
    status: "delayed",
    shift: "collection",
  }),
  row("supplier", "out", "2026-09-05", 480_000, "Servicio técnico", {
    status: "settled",
    settledCents: 480_000,
  }),
];

function row(
  node: string,
  direction: Movement["direction"],
  dueDate: string,
  amountCents: number,
  description: string,
  extra: Partial<Movement> = {},
): Movement {
  return {
    id: `fallback-${node}-${dueDate}`,
    companyId: "co_demo_agency",
    node,
    direction,
    dueDate,
    amountCents,
    settledCents: 0,
    status: "expected",
    // A fact is knowable on its date, or at the cut-off if it is still ahead.
    knownAt: dueDate < CUTOFF ? dueDate : CUTOFF,
    source: "bank",
    shift: "none",
    scale: "none",
    exposure: "none",
    provenance: "known",
    description,
    ...extra,
  };
}
