export interface Business {
  id: string;
  name: string;
  owner: string;
  employees: number;
  balance: number;
  concentration: number;
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
