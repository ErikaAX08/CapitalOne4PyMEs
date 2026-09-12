import type { Business, FinancialTransaction } from "../model/types";
export interface FinancialDataSource {
  getBusiness(): Promise<Business>;
  getTransactions(): Promise<FinancialTransaction[]>;
}
