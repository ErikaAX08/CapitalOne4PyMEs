import type { SimulationFlowState } from "@features/scenario-simulation";
import type { SimulationOutput } from "@entities/simulation";
// Capital One palette: solid, active, uncertain, stressed.
export const BLOCK_HEX_COLORS = ["#004878", "#2a7fa8", "#78a6bd", "#d22e1e"];
export const TOWER_LEVELS = [
  ["Efectivo", "Crédito disponible", "Reservas"],
  ["Cuentas por cobrar", "Efectivo", "Reservas"],
  ["Crédito disponible", "Cuentas por cobrar", "Efectivo"],
  ["Nómina", "Proveedores", "Inventario"],
  ["Capacidad", "Nómina", "Proveedores"],
  ["Inventario", "Capacidad", "Nómina"],
  ["Proveedores", "Inventario", "Capacidad"],
  ["Contratos", "Proyectos", "Cliente principal"],
  ["Cumplimiento fiscal", "Contratos", "Proyectos"],
  ["Cliente principal", "Cumplimiento fiscal", "Contratos"],
  ["Proyectos", "Cliente principal", "Cumplimiento fiscal"],
  ["Contratos", "Proyectos", "Cliente principal"],
];
export const TOWER_TIERS = [
  {
    name: "Base",
    levels: "Niveles 1–3",
    area: "Finanzas y liquidez",
    role: "Los soportes",
  },
  {
    name: "Centro",
    levels: "Niveles 4–7",
    area: "Operaciones y personas",
    role: "El motor",
  },
  {
    name: "Cima",
    levels: "Niveles 8–12",
    area: "Ventas, clientes y entorno",
    role: "La exposición",
  },
] as const;

export function getBlockStructure(index: number) {
  const level = Math.floor(index / 3) + 1;
  const tier =
    level <= 3 ? TOWER_TIERS[0] : level <= 7 ? TOWER_TIERS[1] : TOWER_TIERS[2];
  return {
    level,
    label: TOWER_LEVELS[level - 1][index % 3],
    tier,
  };
}
export interface TowerViewModel {
  lost: number;
  collapsed: boolean;
  staticFall: boolean;
  risk: boolean;
  description: string;
  blockColors: number[];
  blockOffsets: number[];
  expandedBlocks: boolean[];
  crackedBlocks: boolean[];
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
  const hasLiquidityMitigation = output.towerBlockChanges.some(
    (c) => c.action === "addLiquidity",
  );
  const isCreditProject = hasDelay && hasAddIncome;
  const isRecovering = hasLiquidityMitigation && state === "mitigating";
  const stressProgress =
    state === "result"
      ? 1
      : isRecovering
        ? 1 - progress
        : state === "simulating"
          ? progress
          : 0;
  const receivableStress = isCreditProject || isRecovering;
  const payrollStress = isCreditProject || isRecovering;

  function colorFor(index: number): number {
    const level = Math.floor(index / 3) + 1;
    if (index === 9 && hasLiquidityMitigation && state === "recovered")
      return 0;
    if ((state === "mitigating" || state === "recovered") && level <= 3)
      return 0;
    if (level <= 3) return 0;
    if (level <= 7) return 1;
    return isCreditProject && index === 22 ? 1 : 2;
  }
  const blockColors = Array.from({ length: 36 }, (_, i) => colorFor(i));
  const blockOffsets = Array.from({ length: 36 }, (_, index) => {
    if (index === 7 && receivableStress)
      return 3 * Math.max(0, Math.min(1, (stressProgress - 0.65) / 0.35));
    if (index === 9 && payrollStress)
      return 3 * Math.max(0, Math.min(1, (stressProgress - 0.89) / 0.11));
    return 0;
  });
  const expandedBlocks = Array.from(
    { length: 36 },
    (_, index) =>
      index === 22 &&
      (isCreditProject || isRecovering) &&
      stressProgress > 0.12,
  );
  const crackedBlocks = Array.from(
    { length: 36 },
    (_, index) =>
      (index === 7 && receivableStress && stressProgress > 0.34) ||
      (index === 9 && payrollStress && stressProgress > 0.68),
  );
  const description = `Estructura 3D de la PyME: ${collapsed ? "colapsada" : output.status.toLowerCase()}. ${lost} bloques retirados. Base financiera, motor operativo y cima comercial.`;
  return {
    lost,
    collapsed,
    staticFall,
    risk,
    description,
    blockColors,
    blockOffsets,
    expandedBlocks,
    crackedBlocks,
  };
}
