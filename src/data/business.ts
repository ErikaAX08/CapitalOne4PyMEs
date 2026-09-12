import type { Business, FinancialDataSource } from "./types";
import { transactions } from "./transactions";
export const business: Business = {
  id: "luna",
  name: "Distribuidora Luna",
  owner: "Mariana",
  employees: 12,
  balance: 280000,
  concentration: 42,
};
// Sustituir este adaptador con Capital One Nessie API. No hay llamadas externas en la demo.
export const mockDataSource: FinancialDataSource = {
  getBusiness: async () => business,
  getTransactions: async () => transactions,
};
