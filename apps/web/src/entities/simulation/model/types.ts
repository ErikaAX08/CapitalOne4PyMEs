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
export interface SimulatedExpense {
  id: string;
  category: string;
  amount: number;
}
