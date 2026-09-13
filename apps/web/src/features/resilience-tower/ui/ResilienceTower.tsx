import {
  Component,
  useCallback,
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
  rotationSpeed: number;
  instantResult?: boolean;
  expenseBlocks?: number;
}
class SceneBoundary extends Component<
  { children: ReactNode; resetKey: number },
  { failed: boolean; seenResetKey: number }
> {
  state = { failed: false, seenResetKey: this.props.resetKey };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  // Al reiniciar la simulacion volvemos a intentar la escena 3D. No usamos
  // `key` en el componente porque eso remontaria el Canvas (y con el, su
  // contexto WebGL) en cada reinicio.
  static getDerivedStateFromProps(
    props: { resetKey: number },
    state: { seenResetKey: number },
  ) {
    return props.resetKey === state.seenResetKey
      ? null
      : { failed: false, seenResetKey: props.resetKey };
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
  rotationSpeed,
  instantResult = false,
  expenseBlocks = 0,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);
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
        <SceneBoundary resetKey={resetKey}>
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
            rotationSpeed={rotationSpeed}
            onReady={handleReady}
          />
          {/* Aviso de carga como capa HTML encima del Canvas: un <Suspense>
              alrededor del Canvas lo desmontaria y provocaria la perdida del
              contexto WebGL. */}
          {!ready && (
            <div className="absolute inset-0 z-[2] bg-surface-subtle">
              <TowerFallback>Preparando tu torre 3D…</TowerFallback>
            </div>
          )}
        </SceneBoundary>
      ) : (
        <TowerFallback>
          Vista 3D no disponible. {viewModel.description} Puedes seguir
          simulando gastos y consultar las métricas.
        </TowerFallback>
      )}
      {selectedBlock && selected !== null && (
        <div className="absolute right-[15px] bottom-[42px] left-[15px] z-[3] rounded-xl border border-hairline bg-surface-subtle p-4 shadow-geist-floating">
          <button
            aria-label="Cerrar detalle de bloque"
            onClick={() => setSelected(null)}
            className="float-right min-h-[30px] min-w-[30px] border-0 bg-transparent text-[20px] text-body-muted"
          >
            ×
          </button>
          <span className="font-mono block text-xs font-medium tracking-normal text-body-muted uppercase">
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
