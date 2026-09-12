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
    <div
      className="rounded-xl border border-[#dfe7f0] bg-white p-[23px] max-[700px]:p-[18px]"
      aria-live="polite"
    >
      <div className="flex items-center gap-[10px] text-[#487fca] max-[700px]:flex-wrap max-[700px]:gap-[7px]">
        <Sparkles size={20} />
        <strong className="text-[14px] max-[700px]:text-[12px]">
          {mitigating ? "Un anticipo cambia la historia" : scenarioTitle}
        </strong>
        <button
          className="ml-auto inline-flex items-center gap-[7px] border-0 bg-transparent py-[10px] text-[12px] text-[#3774cb] max-[700px]:text-[11px]"
          onClick={onSkip}
        >
          Ver resultado <ArrowRight size={15} />
        </button>
      </div>
      <p className="my-5 text-[13px] text-[#6f829c] max-[700px]:leading-[1.7]">
        {mitigating
          ? "El 40% de anticipo refuerza las primeras semanas."
          : isContract
            ? phase
            : progress < 0.6
              ? "Proyectamos cobros y obligaciones de las próximas semanas…"
              : "Evaluamos el efecto sobre tu liquidez."}
      </p>
      <div className="h-[5px] overflow-hidden rounded-[4px] bg-[#edf2f9]">
        <div
          style={{ width: `${progress * 100}%` }}
          className="h-full bg-[#548de0] transition-[width] duration-[50ms]"
        />
      </div>
      <div className="mt-[15px] flex justify-between text-[12px] text-[#8b9eb5] max-[700px]:text-[10px]">
        <span>01 · Decisión</span>
        <span>02 · Flujo de caja</span>
        <span>03 · Estabilidad</span>
      </div>
    </div>
  );
}
