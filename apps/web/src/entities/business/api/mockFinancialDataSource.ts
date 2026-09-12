import type { FinancialDataSource } from "./financialDataSource";
import { business } from "../fixtures/business";
import { transactions } from "../fixtures/transactions";
// Sustituir este adaptador con Capital One Nessie API. No hay llamadas externas en la demo.
export const mockFinancialDataSource: FinancialDataSource = {
  getBusiness: async () => business,
  getTransactions: async () => transactions,
};
