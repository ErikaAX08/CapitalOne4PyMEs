export type AppState =
  | "intro"
  | "stable"
  | "scenarioSelected"
  | "simulating"
  | "critical"
  | "mitigating"
  | "recovered";
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
export type ScenarioId = "contract" | "equipment" | "delay";
export interface Scenario {
  id: ScenarioId;
  title: string;
  description: string;
  amount: number;
  details: [string, string][];
}
export interface WeeklyProjection {
  week: number;
  balance: number;
  income: number;
  expenses: number;
}
export interface TowerChange {
  week: number;
  action: "removeLiquidity" | "addIncome" | "delayIncome" | "addLiquidity";
}
export interface SimulationOutput {
  removedExpenseBlocks: number;
  simulatedExpenseTotal: number;
  fragilityScore: number;
  survivalWeeks: number;
  recommendedBuffer: number;
  minimumProjectedBalance: number;
  criticalWeek: number | null;
  weeklyProjections: WeeklyProjection[];
  towerBlockChanges: TowerChange[];
  recommendation: string;
  status: "Estable" | "Precaución" | "Crítico";
}
export interface FinancialDataSource {
  getBusiness(): Promise<Business>;
  getTransactions(): Promise<FinancialTransaction[]>;
}

export interface SimulatedExpense {
  id: string;
  category: string;
  amount: number;
}
