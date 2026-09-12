import {
  Component,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { SimulationFlowState } from "@features/scenario-simulation";
import type { SimulationOutput } from "@entities/simulation";
import { formatMoney } from "@shared";
import {
  computeTowerViewModel,
  BLOCK_LABELS,
  BLOCK_VALUES,
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
              collapsed={viewModel.collapsed}
              staticFall={viewModel.staticFall}
              lost={viewModel.lost}
              risk={viewModel.risk}
              blockColors={viewModel.blockColors}
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
      {selected !== null && (
        <div className="absolute right-[15px] bottom-[42px] left-[15px] z-[3] rounded-[10px] border border-[#d5e0ed] bg-[#fffffff5] p-4 shadow-[0_8px_30px_#263c541a]">
          <button
            aria-label="Cerrar detalle de bloque"
            onClick={() => setSelected(null)}
            className="float-right min-h-[30px] min-w-[30px] border-0 bg-transparent text-[20px] text-[#718198]"
          >
            ×
          </button>
          <span className="block text-[11px] tracking-[1px] text-[#5a85b9]">
            SEMANA {Math.floor(selected / 3) + 1}
          </span>
          <strong className="my-[7px] block text-[12px]">
            {BLOCK_LABELS[viewModel.blockColors[selected]]} ·{" "}
            {formatMoney(BLOCK_VALUES[viewModel.blockColors[selected]])}
          </strong>
          <small className="mt-[5px] block text-[12px] text-[#7c8ca1]">
            Estado:{" "}
            {viewModel.blockColors[selected] === 4
              ? "Retrasado"
              : viewModel.blockColors[selected] === 1
                ? "Esperado"
                : "Confirmado"}
          </small>
          <small className="mt-[5px] block text-[12px] text-[#7c8ca1]">
            Bloque ilustrativo · datos simulados
          </small>
        </div>
      )}
    </div>
  );
}
