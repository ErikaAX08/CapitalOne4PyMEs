import { Hand, Layers3, RotateCcw } from "lucide-react";
import type { SimulationFlowState } from "@features/scenario-simulation";
import type { SimulationOutput } from "@entities/simulation";
import { Card, Badge, Button } from "@shared";
import { BLOCK_HEX_COLORS } from "../model/towerPresentation";
import { ResilienceTower } from "./ResilienceTower";
export function TowerCard({
  flowState,
  status,
  expenseBlocks,
  instantResult,
  progress,
  output,
  resetKey,
  reduced,
  onReset,
}: {
  flowState: SimulationFlowState;
  status: SimulationOutput["status"];
  expenseBlocks: number;
  instantResult: boolean;
  progress: number;
  output: SimulationOutput;
  resetKey: number;
  reduced: boolean;
  onReset: () => void;
}) {
  const statusVariant =
    status === "Crítico"
      ? "danger"
      : status === "Precaución"
        ? "warning"
        : "success";
  return (
    <Card className="tower-card relative flex min-h-[604px] flex-col gap-0 overflow-hidden bg-surface-subtle max-[700px]:min-h-[480px] min-[701px]:sticky min-[701px]:top-[22px] min-[701px]:col-start-2 min-[701px]:row-[1/3] min-[701px]:h-[min(830px,calc(100vh-44px))] min-[701px]:min-h-[620px] min-[701px]:self-start">
      <div className="z-1 flex justify-between p-[24px_25px_0] max-[700px]:p-[20px_20px_0]">
        <div>
          <span className="font-mono text-[11px] font-medium tracking-normal text-body-muted uppercase">
            Tu negocio, en perspectiva
          </span>
          <h2 className="font-title mt-1 text-xl font-semibold tracking-[-0.02em]">
            Torre de estabilidad · 3D
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-[34px] w-[34px] max-[700px]:min-h-[42px] max-[700px]:min-w-[42px]"
          aria-label="Reiniciar simulación"
          title="Reiniciar simulación"
          onClick={onReset}
        >
          <RotateCcw size={18} />
        </Button>
      </div>
      <div className="p-[15px_25px_0] max-[700px]:p-[12px_20px_0]">
        <Badge
          variant={statusVariant}
          className="h-auto gap-[6px] px-[10px] py-[6px] text-[12px] font-medium"
        >
          <span className="h-[5px] w-[5px] rounded-full bg-current" />
          {flowState === "simulating"
            ? "Simulando decisión"
            : flowState === "mitigating"
              ? "Recuperando estabilidad"
              : status === "Estable"
                ? "Tu negocio tiene una base sólida"
                : status === "Crítico"
                  ? "La liquidez necesita refuerzo"
                  : "Una estructura con más perspectiva"}
        </Badge>
      </div>
      <div className="relative min-h-[360px] flex-1 max-[700px]:h-[390px] max-[700px]:min-h-[390px] [&>.tower-3d]:absolute [&>.tower-3d]:inset-0">
        <ResilienceTower
          expenseBlocks={expenseBlocks}
          instantResult={instantResult}
          state={flowState}
          progress={progress}
          output={output}
          resetKey={resetKey}
          reduced={reduced}
        />
        <div className="pointer-events-none absolute top-[50px] right-[22px] text-[10px] tracking-[1px] text-body-subtle before:absolute before:top-[4px] before:left-[-30px] before:h-px before:w-[22px] before:bg-hairline-strong before:content-[''] min-[701px]:max-[1000px]:right-[12px] max-[1000px]:before:left-[-14px] max-[1000px]:before:w-[10px] max-[700px]:right-[10px]">
          Semana 12
          <span className="mt-1 block text-[11px] tracking-normal text-body-subtle max-[700px]:text-[9px]">
            Ingresos futuros
          </span>
        </div>
        <div className="pointer-events-none absolute bottom-[75px] right-[22px] text-[10px] tracking-[1px] text-body-subtle before:absolute before:top-[4px] before:left-[-30px] before:h-px before:w-[22px] before:bg-hairline-strong before:content-[''] min-[701px]:max-[1000px]:right-[12px] max-[1000px]:before:left-[-14px] max-[1000px]:before:w-[10px] max-[700px]:right-[10px]">
          Semana 1
          <span className="mt-1 block text-[11px] tracking-normal text-body-subtle max-[700px]:text-[9px]">
            Tu base de hoy
          </span>
        </div>
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 flex items-center justify-center gap-[7px] text-[11px] text-body-subtle">
          <Hand size={15} /> Cada gasto retira soporte · Toca un bloque
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 p-[17px_10px_15px] max-[1000px]:gap-[9px] max-[700px]:p-[14px_8px]">
        {["Liquidez", "Cobros", "Gastos", "Obligaciones", "Inciertos"].map(
          (label, i) => (
            <span
              key={label}
              className="flex items-center gap-[5px] text-[11px] text-body-muted max-[700px]:text-[9px]"
            >
              <i
                style={{ background: BLOCK_HEX_COLORS[i] }}
                className="h-[7px] w-[7px]"
              />
              {label}
            </span>
          ),
        )}
      </div>
      <div className="flex items-center justify-center gap-[7px] border-t border-hairline bg-canvas/40 p-[13px] text-[11px] text-body-muted">
        <Layers3 size={15} /> 12 niveles. 12 semanas. Una mirada al futuro.
      </div>
    </Card>
  );
}
