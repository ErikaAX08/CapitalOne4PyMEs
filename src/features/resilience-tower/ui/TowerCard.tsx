import { Hand, Layers3, RotateCcw } from "lucide-react";
import type { SimulationFlowState } from "../../scenario-simulation";
import type { SimulationOutput } from "../../../entities/simulation";
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
  const statusClass =
    status === "Crítico"
      ? "bg-[#fceae7] text-[#b95243]"
      : status === "Precaución"
        ? "bg-[#fff3d8] text-[#916713]"
        : "bg-[#eaf6f0] text-[#318663]";
  return (
    <section className="tower-card relative flex min-h-[604px] flex-col overflow-hidden rounded-[14px] border border-[#e0e7ef] bg-[#f0f4f8] max-[700px]:min-h-[480px] min-[701px]:sticky min-[701px]:top-[22px] min-[701px]:col-start-2 min-[701px]:row-[1/3] min-[701px]:h-[min(830px,calc(100vh-44px))] min-[701px]:min-h-[620px] min-[701px]:self-start">
      <div className="z-1 flex justify-between p-[24px_25px_0] max-[700px]:p-[20px_20px_0]">
        <div>
          <span className="text-[11px] font-semibold tracking-[1.4px] text-[#8a9aae] max-[700px]:text-[9px]">
            TU NEGOCIO, EN PERSPECTIVA
          </span>
          <h2 className="mt-[6px] text-[19px] font-semibold tracking-[-0.5px]">
            Torre de estabilidad · 3D
          </h2>
        </div>
        <button
          className="grid h-[34px] w-[34px] place-items-center rounded-lg border border-[#dce4ed] bg-[#ffffffad] text-[#73849a] max-[700px]:min-h-[42px] max-[700px]:min-w-[42px]"
          aria-label="Reiniciar simulación"
          title="Reiniciar simulación"
          onClick={onReset}
        >
          <RotateCcw size={18} />
        </button>
      </div>
      <div className="p-[15px_25px_0] max-[700px]:p-[12px_20px_0]">
        <span
          className={`inline-flex items-center gap-[6px] rounded-[20px] border border-[#e1e9ee] bg-[#ffffffbd] px-[10px] py-[6px] text-[12px] font-medium whitespace-nowrap ${statusClass}`}
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
        </span>
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
        <div className="hidden">
          SEMANA 12<span>Ingresos futuros</span>
        </div>
        <div className="hidden">
          SEMANA 1<span>Tu base de hoy</span>
        </div>
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 flex items-center justify-center gap-[7px] text-[11px] text-[#8c9aaa]">
          <Hand size={15} /> Cada gasto retira soporte · Toca un bloque
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 p-[17px_10px_15px] max-[1000px]:gap-[9px] max-[700px]:p-[14px_8px]">
        {["Liquidez", "Cobros", "Gastos", "Obligaciones", "Inciertos"].map(
          (label, i) => (
            <span
              key={label}
              className="flex items-center gap-[5px] text-[11px] text-[#65778e] max-[700px]:text-[9px]"
            >
              <i
                style={{
                  background: [
                    "#4285dc",
                    "#54b69a",
                    "#b1bac7",
                    "#e88478",
                    "#e5bb54",
                  ][i],
                }}
                className="h-[7px] w-[7px] rounded-[2px]"
              />
              {label}
            </span>
          ),
        )}
      </div>
      <div className="flex items-center justify-center gap-[7px] border-t border-[#e1e7ef] bg-[#ffffff40] p-[13px] text-[11px] text-[#65778e]">
        <Layers3 size={15} /> 12 niveles. 12 semanas. Una mirada al futuro.
      </div>
    </section>
  );
}
