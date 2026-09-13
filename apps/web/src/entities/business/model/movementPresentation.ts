import type { Movement, MovementStatus } from "./types";

/** The Spanish the interface reads, built at the boundary: the contract stays
 *  English (`payroll`, `expected`) and the screen stays Spanish, exactly as the
 *  root README's language policy requires. */

/** The twenty-four `graph_nodes` of contracts/database/schema.sql, grouped the
 *  way the business reads them rather than by stack. A node with no entry falls
 *  back to its own identifier, so a row the database returns is never blank. */
const NODE_LABELS: Record<string, string> = {
  cash: "Efectivo",
  reserve: "Reservas",
  debt: "Deuda",
  credit: "Crédito",
  sales: "Ventas",
  customer: "Clientes",
  invoice: "Facturación",
  collection: "Cobranza",
  delivery: "Entregas",
  materials: "Materiales",
  capacity: "Capacidad",
  supplier: "Proveedores",
  payroll: "Nómina",
  staff: "Personal",
  hiring: "Contrataciones",
  critical_person: "Persona clave",
  billing_system: "Sistema de facturación",
  infrastructure: "Infraestructura",
  backups: "Respaldos",
  tech_provider: "Proveedor tecnológico",
  tax: "Impuestos",
  license: "Licencias",
  insurance: "Seguros",
  regulation: "Regulación",
};

/** The nodes the form offers, in the order a person thinks of them. The rest
 *  stay readable in the list but are not proposed for a manual entry. */
export const COMMON_NODES = [
  "collection",
  "payroll",
  "supplier",
  "materials",
  "tax",
  "debt",
  "hiring",
  "capacity",
] as const;

export function nodeLabel(node: string): string {
  return NODE_LABELS[node] ?? node;
}

const STATUS_LABELS: Record<MovementStatus, string> = {
  expected: "Esperado",
  confirmed: "Confirmado",
  delayed: "Retrasado",
  settled: "Liquidado",
  cancelled: "Cancelado",
};

export function statusLabel(status: MovementStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/** The badge variant each status reads as. `delayed` is the only one that is a
 *  warning: an obligation that moved is what puts the calendar under tension. */
export function statusVariant(
  status: MovementStatus,
): "neutral" | "success" | "warning" | "info" {
  switch (status) {
    case "delayed":
      return "warning";
    case "settled":
      return "success";
    case "confirmed":
      return "info";
    default:
      return "neutral";
  }
}

const SOURCE_LABELS: Record<Movement["source"], string> = {
  bank: "Banco",
  cfdi: "CFDI",
  manual: "Manual",
  rule: "Recurrente",
  action: "Decisión",
};

export function sourceLabel(source: Movement["source"]): string {
  return SOURCE_LABELS[source] ?? source;
}

/** What the movement still moves: the contractual amount less what has been
 *  reconciled. It mirrors Movement.Outstanding() in the Go domain. */
export function outstandingCents(movement: Movement): number {
  return movement.amountCents - movement.settledCents;
}

/** Whether the movement still affects the cash calendar (docs/data-model.md §4). */
export function isOpen(movement: Movement): boolean {
  return movement.status !== "settled" && movement.status !== "cancelled";
}

/** The long Spanish date the list reads ("18 de septiembre de 2026"). Built
 *  from the ISO parts rather than through the Date constructor, which would
 *  shift the day by one in any timezone behind UTC. */
export function dateText(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const months = [
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
  ];
  return `${day} de ${months[month - 1]} de ${year}`;
}

/** The totals the ledger header reports. Only open movements count: a settled
 *  or cancelled one no longer moves money. */
export function totals(movements: Movement[]) {
  let incoming = 0;
  let outgoing = 0;
  for (const movement of movements) {
    if (!isOpen(movement)) continue;
    const amount = outstandingCents(movement);
    if (movement.direction === "in") incoming += amount;
    else outgoing += amount;
  }
  return { incoming, outgoing, net: incoming - outgoing };
}
