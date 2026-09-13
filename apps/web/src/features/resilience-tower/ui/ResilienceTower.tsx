import {
  Component,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { SimulationFlowState } from "@features/scenario-simulation";
import type { SimulationOutput } from "@entities/simulation";
import {
  computeTowerViewModel,
  getBlockStructure,
} from "../model/towerPresentation";
import { TowerScene } from "./TowerScene";
import { TowerFallback } from "./TowerFallback";
interface Props {
  state: SimulationFlowState;
  progress: number;
  output: SimulationOutput;
  resetKey: number;
  reduced: boolean;
  instantResult?: boolean;
  expenseBlocks?: number;
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <TowerFallback>
        Vista 3D no disponible. Puedes seguir simulando gastos y consultar las
        métricas.
      </TowerFallback>
    ) : (
      this.props.children
    );
  }
}
export function ResilienceTower({
  state,
  progress,
  output,
  resetKey,
  reduced,
  instantResult = false,
  expenseBlocks = 0,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [webgl] = useState(() => {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      if (!context) return false;
      context.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  });
  useEffect(() => setSelected(null), [resetKey, expenseBlocks]);
  const viewModel = computeTowerViewModel({
    state,
    progress,
    output,
    expenseBlocks,
    reduced,
    instantResult,
  });
  const selectedBlock = selected === null ? null : getBlockStructure(selected);
  const slidingFailure =
    output.towerBlockChanges.some((c) => c.action === "delayIncome") &&
    output.towerBlockChanges.some((c) => c.action === "addIncome");
  return (
    <div
      className="tower-3d relative h-full w-full overflow-hidden [&_canvas]:touch-none"
      role="group"
      aria-label={viewModel.description}
    >
      {webgl ? (
        <SceneBoundary key={resetKey}>
          <Suspense
            fallback={<TowerFallback>Preparando tu torre 3D…</TowerFallback>}
          >
            <TowerScene
              resetKey={resetKey}
              expenseBlocks={expenseBlocks}
              collapsed={viewModel.collapsed && !slidingFailure}
              staticFall={viewModel.staticFall && !slidingFailure}
              lost={slidingFailure ? expenseBlocks : viewModel.lost}
              risk={viewModel.risk}
              blockColors={viewModel.blockColors}
              blockOffsets={viewModel.blockOffsets}
              expandedBlocks={viewModel.expandedBlocks}
              crackedBlocks={viewModel.crackedBlocks}
              onSelect={setSelected}
              reduced={reduced}
            />
          </Suspense>
        </SceneBoundary>
      ) : (
        <TowerFallback>
          Vista 3D no disponible. {viewModel.description} Puedes seguir
          simulando gastos y consultar las métricas.
        </TowerFallback>
      )}
      {selectedBlock && selected !== null && (
        <div className="absolute right-[15px] bottom-[42px] left-[15px] z-[3] border border-hairline-strong bg-canvas p-4 shadow-[0_0.5rem_1.5rem_rgba(16,42,58,0.10)]">
          <button
            aria-label="Cerrar detalle de bloque"
            onClick={() => setSelected(null)}
            className="float-right min-h-[30px] min-w-[30px] border-0 bg-transparent text-[20px] text-body-muted"
          >
            ×
          </button>
          <span className="font-title block text-[11px] font-medium text-brand-blue">
            {selectedBlock.tier.name} · Nivel {selectedBlock.level}
          </span>
          <strong className="my-[7px] block text-[14px]">
            {selectedBlock.label}
          </strong>
          <span className="text-[11px] text-body">
            {viewModel.blockOffsets[selected] >= 2.9
              ? "Retirado: perdió su soporte"
              : viewModel.crackedBlocks[selected]
                ? "Agrietado: capacidad en peligro"
                : "Entero: capacidad disponible"}
          </span>
          <small className="mt-[5px] block text-[11px] leading-[1.5] text-body-muted">
            {selectedBlock.tier.area} · {selectedBlock.tier.role}
          </small>
          <small className="mt-[5px] block text-[11px] leading-[1.5] text-body-subtle">
            {selectedBlock.level <= 3
              ? "Sostiene directamente las capacidades de los niveles superiores."
              : selectedBlock.level <= 7
                ? "Depende de la base financiera y mantiene la operación diaria."
                : "Depende del motor operativo y está expuesto al entorno."}
          </small>
          <small className="mt-[5px] block text-[12px] text-body-subtle">
            Bloque estructural ilustrativo · datos simulados
          </small>
        </div>
      )}
    </div>
  );
}
