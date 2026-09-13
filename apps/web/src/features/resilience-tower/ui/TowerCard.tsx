import { Hand, RotateCcw } from "lucide-react";
import type { SimulationFlowState } from "@features/scenario-simulation";
import type { SimulationOutput } from "@entities/simulation";
import { Card, Badge, Button } from "@shared";
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
  simulationWeeks,
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
  simulationWeeks: number;
  onReset: () => void;
}) {
  const currentDay = Math.max(1, Math.ceil(progress * simulationWeeks * 7));
  const statusVariant =
    status === "Crítico"
      ? "danger"
      : status === "Precaución"
        ? "warning"
        : "success";
  const hasCollectionDelay = output.towerBlockChanges.some(
    ({ action }) => action === "delayIncome",
  );
  const hasReinforcement = output.towerBlockChanges.some(
    ({ action }) => action === "addIncome" || action === "addLiquidity",
  );
  const towerGuidance =
    flowState === "simulating" && hasCollectionDelay
      ? "El cobro se retrasa: observa cómo la base expone la nómina"
      : flowState === "mitigating" || hasReinforcement
        ? "El refuerzo vuelve a sostener la operación y el crecimiento"
        : status === "Crítico"
          ? "La base perdió soporte: toca un bloque para entender por qué"
          : expenseBlocks > 0
            ? "Cada gasto retira soporte de los cimientos de tu empresa"
            : "Simula una decisión y observa cómo cambia tu empresa";
  return (
    <Card className="tower-card relative flex min-h-[604px] flex-col gap-0 overflow-hidden bg-surface-subtle py-0 max-[700px]:min-h-[480px] min-[701px]:sticky min-[701px]:top-[22px] min-[701px]:h-[min(830px,calc(100vh-44px))] min-[701px]:min-h-[620px]">
      <div className="z-1 flex justify-between p-[24px_25px_0] max-[700px]:p-[20px_20px_0]">
        <div>
          <span className="font-mono text-[11px] font-medium tracking-normal text-body-muted uppercase">
            Mapa visual de dependencias
          </span>
          <h2 className="font-title mt-1 text-xl font-semibold tracking-[-0.02em]">
            Esta torre representa tu empresa
          </h2>
          <p className="mt-1.5 max-w-[390px] text-[10px] leading-[1.5] text-body-muted">
            Los cimientos financieros sostienen la operación y el crecimiento.
            Si la base se debilita, los niveles superiores quedan en riesgo.
          </p>
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
        {(flowState === "simulating" || flowState === "mitigating") && (
          <span className="ml-2 text-[10px] font-medium text-body-muted">
            Día {currentDay} de {simulationWeeks * 7}
          </span>
        )}
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
        <div className="pointer-events-none absolute top-[48px] right-[22px] max-w-[145px] text-[10px] text-body-subtle before:absolute before:top-[5px] before:left-[-30px] before:h-px before:w-[22px] before:bg-hairline-strong before:content-[''] min-[701px]:max-[1000px]:right-[12px] max-[1000px]:before:left-[-14px] max-[1000px]:before:w-[10px] max-[700px]:right-[9px] max-[700px]:max-w-[100px]">
          <strong className="font-medium text-body">
            Crecimiento · Niveles 8–12
          </strong>
          <span className="mt-1 block text-[10px] leading-[1.35] text-body-subtle max-[700px]:text-[8px]">
            Ventas, clientes y entorno
          </span>
        </div>
        <div className="pointer-events-none absolute top-[47%] right-[22px] max-w-[145px] text-[10px] text-body-subtle before:absolute before:top-[5px] before:left-[-30px] before:h-px before:w-[22px] before:bg-hairline-strong before:content-[''] min-[701px]:max-[1000px]:right-[12px] max-[1000px]:before:left-[-14px] max-[1000px]:before:w-[10px] max-[700px]:right-[9px] max-[700px]:max-w-[100px]">
          <strong className="font-medium text-body">
            Operación · Niveles 4–7
          </strong>
          <span className="mt-1 block text-[10px] leading-[1.35] text-body-subtle max-[700px]:text-[8px]">
            Operaciones y personas
          </span>
        </div>
        <div className="pointer-events-none absolute right-[22px] bottom-[63px] max-w-[145px] text-[10px] text-body-subtle before:absolute before:top-[5px] before:left-[-30px] before:h-px before:w-[22px] before:bg-hairline-strong before:content-[''] min-[701px]:max-[1000px]:right-[12px] max-[1000px]:before:left-[-14px] max-[1000px]:before:w-[10px] max-[700px]:right-[9px] max-[700px]:max-w-[100px]">
          <strong className="font-medium text-body">
            Cimientos · Niveles 1–3
          </strong>
          <span className="mt-1 block text-[10px] leading-[1.35] text-body-subtle max-[700px]:text-[8px]">
            Finanzas y liquidez
          </span>
        </div>
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 flex items-center justify-center gap-[7px] px-4 text-center text-[11px] text-body-subtle">
          <Hand size={15} className="shrink-0" /> {towerGuidance}
        </div>
      </div>
    </Card>
  );
}
