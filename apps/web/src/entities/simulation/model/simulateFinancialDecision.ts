import type { Business, FinancialTransaction } from "@entities/business";
import type { Scenario } from "@entities/scenario";
import type { SimulationOutput, SimulatedExpense } from "./types";
import { balances } from "../fixtures/projections";
import { formatMoney } from "@shared";
export function simulateFinancialDecision(
  business: Business,
  transactions: FinancialTransaction[],
  scenario: Scenario | null,
  mitigations: string[] = [],
  expenses: SimulatedExpense[] = [],
): SimulationOutput {
  if (
    !transactions.length ||
    !Number.isFinite(business.balance) ||
    expenses.some(
      (expense) => !Number.isFinite(expense.amount) || expense.amount <= 0,
    )
  )
    throw new Error("Se requieren datos válidos para simular.");
  const simulatedExpenseTotal = expenses.reduce(
    (total, expense) => total + expense.amount,
    0,
  );
  const removedExpenseBlocks = Math.min(
    35,
    expenses.reduce(
      (total, expense) =>
        total + Math.max(1, Math.ceil(expense.amount / 24000)),
      0,
    ),
  );
  const recovered =
    scenario?.id === "contract" && mitigations.includes("advance25");
  const key = recovered ? "recovered" : (scenario?.id ?? "stable");
  const metrics = {
    stable: [31, 14, 24000],
    contract: [78, 11, 40000],
    recovered: [36, 14, 18000],
    equipment: [49, 10, 42000],
    delay: [64, 8, 72000],
  }[key];
  // Integración futura: motor real de homología persistente para señal estructural.
  // Integración futura: simulación de caja real reemplaza estas proyecciones ilustrativas.
  const weeklyProjections = balances[key].map((balance, i) => {
    const previous = i ? balances[key][i - 1] : 280000;
    const income = Math.max(i === 8 ? 160000 : 68000, balance - previous);
    return {
      week: i + 1,
      balance: balance + business.balance - 280000 - simulatedExpenseTotal,
      income,
      expenses:
        previous + income - balance + (i === 0 ? simulatedExpenseTotal : 0),
    };
  });
  const minimumProjectedBalance = Math.min(
    ...weeklyProjections.map((w) => w.balance),
  );
  return {
    removedExpenseBlocks,
    simulatedExpenseTotal,
    fragilityScore: Math.min(
      100,
      metrics[0] + Math.round(simulatedExpenseTotal / 3000),
    ),
    survivalWeeks: Math.max(
      0,
      metrics[1] - Math.ceil(simulatedExpenseTotal / 20000),
    ),
    recommendedBuffer: Math.max(
      metrics[2] + Math.round(simulatedExpenseTotal * 0.15),
      -minimumProjectedBalance,
    ),
    minimumProjectedBalance,
    criticalWeek:
      minimumProjectedBalance < 0
        ? weeklyProjections.find((w) => w.balance === minimumProjectedBalance)!
            .week
        : null,
    weeklyProjections,
    towerBlockChanges: recovered
      ? [1, 2, 3, 4].map((week) => ({ week, action: "addLiquidity" }))
      : scenario?.id === "contract"
        ? [
            ...[1, 2, 3, 4].map((week) => ({
              week,
              action: "removeLiquidity" as const,
            })),
            ...[9, 10, 11, 12].map((week) => ({
              week,
              action: "addIncome" as const,
            })),
            { week: 7, action: "delayIncome" },
          ]
        : scenario?.id === "delay"
          ? [{ week: 3, action: "delayIncome" }]
          : scenario
            ? [{ week: 1, action: "removeLiquidity" }]
            : [],
    status:
      metrics[0] + Math.round(simulatedExpenseTotal / 3000) >= 70 ||
      minimumProjectedBalance < 0
        ? "Crítico"
        : metrics[0] + Math.round(simulatedExpenseTotal / 3000) >= 40
          ? "Precaución"
          : "Estable",
    recommendation:
      simulatedExpenseTotal > 0
        ? minimumProjectedBalance < 0
          ? `Estos gastos dejan un saldo mínimo proyectado de ${formatMoney(minimumProjectedBalance)}. Reduce o escalona los pagos, o reserva al menos ${formatMoney(-minimumProjectedBalance)} de liquidez adicional.`
          : `Con ${formatMoney(simulatedExpenseTotal)} en gastos adicionales, conserva ${formatMoney(metrics[2] + Math.round(simulatedExpenseTotal * 0.15))} de capital de trabajo y prioriza los pagos esenciales.`
        : recovered
          ? "Con el anticipo, el negocio conserva suficiente liquidez para ejecutar el contrato sin comprometer la nómina."
          : scenario?.id === "contract"
            ? "Pide un anticipo de 25% para cubrir el desfase entre los costos del proyecto y el cobro del cliente."
            : scenario?.id === "equipment"
              ? "Escalona la compra o reserva $42,000 de capital de trabajo para proteger tu operación."
              : scenario?.id === "delay"
                ? "Acuerda cobros parciales y reserva $72,000 para cubrir las obligaciones durante el retraso."
                : "Tu negocio puede mantener su operación durante 14 semanas bajo las condiciones actuales.",
  };
}
