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
  return (
    <section className="tower-card">
      <div className="tower-heading">
        <div>
          <span className="eyebrow">TU NEGOCIO, EN PERSPECTIVA</span>
          <h2>Torre de estabilidad · 3D</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Reiniciar simulación"
          title="Reiniciar simulación"
          onClick={onReset}
        >
          <RotateCcw size={18} />
        </button>
      </div>
      <div className="tower-status">
        <span
          className={`status ${status === "Crítico" ? "danger" : status === "Precaución" ? "warning" : "stable"}`}
        >
          <span />
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
      <div className="scene">
        <ResilienceTower
          expenseBlocks={expenseBlocks}
          instantResult={instantResult}
          state={flowState}
          progress={progress}
          output={output}
          resetKey={resetKey}
          reduced={reduced}
        />
        <div className="week-marker top">
          SEMANA 12<span>Ingresos futuros</span>
        </div>
        <div className="week-marker bottom">
          SEMANA 1<span>Tu base de hoy</span>
        </div>
        <div className="scene-hint">
          <Hand size={15} /> Cada gasto retira soporte · Toca un bloque
        </div>
      </div>
      <div className="legend">
        {["Liquidez", "Cobros", "Gastos", "Obligaciones", "Inciertos"].map(
          (label, i) => (
            <span key={label}>
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
              />
              {label}
            </span>
          ),
        )}
      </div>
      <div className="tower-footer">
        <Layers3 size={15} /> 12 niveles. 12 semanas. Una mirada al futuro.
      </div>
    </section>
  );
}
