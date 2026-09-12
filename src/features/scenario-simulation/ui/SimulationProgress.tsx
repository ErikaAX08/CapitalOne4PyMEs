import { ArrowRight, Sparkles } from "lucide-react";
export function SimulationProgress({
  mitigating,
  scenarioTitle,
  isContract,
  phase,
  progress,
  onSkip,
}: {
  mitigating: boolean;
  scenarioTitle?: string;
  isContract: boolean;
  phase: string;
  progress: number;
  onSkip: () => void;
}) {
  return (
    <div className="simulation" aria-live="polite">
      <div className="simulation-title">
        <Sparkles size={20} />
        <strong>
          {mitigating ? "Un anticipo cambia la historia" : scenarioTitle}
        </strong>
        <button className="text-button" onClick={onSkip}>
          Ver resultado <ArrowRight size={15} />
        </button>
      </div>
      <p>
        {mitigating
          ? "El 40% de anticipo refuerza las primeras semanas."
          : isContract
            ? phase
            : progress < 0.6
              ? "Proyectamos cobros y obligaciones de las próximas semanas…"
              : "Evaluamos el efecto sobre tu liquidez."}
      </p>
      <div className="progress-track">
        <div style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="timeline">
        <span>01 · Decisión</span>
        <span>02 · Flujo de caja</span>
        <span>03 · Estabilidad</span>
      </div>
    </div>
  );
}
