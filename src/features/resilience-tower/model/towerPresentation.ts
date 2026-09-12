import type { SimulationFlowState } from "@features/scenario-simulation";
import type { SimulationOutput } from "@entities/simulation";
export const BLOCK_HEX_COLORS = [
  "#4389dc",
  "#58b69b",
  "#afbac9",
  "#e48b7d",
  "#e3bd56",
];
export const BLOCK_LABELS = [
  "Liquidez disponible",
  "Cobro esperado",
  "Gasto operativo",
  "Nómina",
  "Cobro retrasado",
];
export const BLOCK_VALUES = [24000, 68000, 24000, 72000, 160000];
export interface TowerViewModel {
  lost: number;
  collapsed: boolean;
  staticFall: boolean;
  risk: boolean;
  description: string;
  blockColors: number[];
}
export function computeTowerViewModel({
  state,
  progress,
  output,
  expenseBlocks,
  reduced,
  instantResult,
}: {
  state: SimulationFlowState;
  progress: number;
  output: SimulationOutput;
  expenseBlocks: number;
  reduced: boolean;
  instantResult: boolean;
}): TowerViewModel {
  const scenarioLoss = output.towerBlockChanges.filter(
    (c) => c.action === "removeLiquidity",
  ).length;
  const removed =
    state === "simulating"
      ? Math.floor(scenarioLoss * Math.min(progress / 0.45, 1))
      : state === "result"
        ? scenarioLoss
        : 0;
  const lost = Math.min(35, expenseBlocks + removed);
  const collapsed =
    (expenseBlocks > 0 && output.minimumProjectedBalance < 0) ||
    (output.status === "Crítico" &&
      (state === "result" || (state === "simulating" && progress >= 0.78)));
  const staticFall = collapsed && (reduced || instantResult);
  const risk = output.fragilityScore >= 40;
  const hasDelay = output.towerBlockChanges.some(
    (c) => c.action === "delayIncome",
  );
  const hasAddIncome = output.towerBlockChanges.some(
    (c) => c.action === "addIncome",
  );
  function colorFor(index: number): number {
    const week = Math.floor(index / 3) + 1;
    if (hasDelay && progress > 0.58 && week >= 6 && week <= 8) return 4;
    if (hasAddIncome && progress > 0.35 && week >= 9) return 1;
    if ((state === "mitigating" || state === "recovered") && week <= 4)
      return 0;
    return index % 3 === 0 ? 0 : (index + Math.floor(index / 6)) % 4;
  }
  const blockColors = Array.from({ length: 36 }, (_, i) => colorFor(i));
  const description = `Torre 3D: ${collapsed ? "colapsada" : output.status.toLowerCase()}. ${lost} bloques retirados. ${output.survivalWeeks} semanas de supervivencia.`;
  return { lost, collapsed, staticFall, risk, description, blockColors };
}
