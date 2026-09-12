import type { FinancialTransaction } from "./types";
const templates = [
  ["Nómina", "Equipo Luna", 72000],
  ["Renta", "Inmuebles del Norte", 24000],
  ["Inventario", "Suministros MX", 95000],
  ["Servicios", "Energía y telecomunicaciones", 6500],
  ["Crédito", "Financiera local", 31000],
  ["Cobros de clientes", "Comercial Atlas", 160000],
  ["Impuestos", "Obligaciones fiscales", 18000],
  ["Transporte", "Logística Luna", 12500],
  ["Mantenimiento", "Servicio técnico", 4800],
  ["Cobros de clientes", "Mercado del Sol", 68000],
] as const;
export const transactions: FinancialTransaction[] = Array.from(
  { length: 40 },
  (_, i) => {
    const [category, merchant, amount] = templates[i % 10];
    return {
      id: `tx-${i + 1}`,
      date: `2026-${String(9 + Math.floor(i / 10)).padStart(2, "0")}-${String(1 + (i % 10) * 3).padStart(2, "0")}`,
      amount,
      direction: category === "Cobros de clientes" ? "income" : "expense",
      category,
      merchant,
      status: i < 10 ? "confirmed" : "expected",
      confidence: category === "Cobros de clientes" ? 0.85 : 1,
    };
  },
);
