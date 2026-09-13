import { ArrowRight, Sparkles } from "lucide-react";
import { Card, Progress, Button } from "@shared";
export function SimulationProgress({
  mitigating,
  scenarioTitle,
  isContract,
  phase,
  progress,
  simulationWeeks,
  onSkip,
}: {
  mitigating: boolean;
  scenarioTitle?: string;
  isContract: boolean;
  phase: string;
  progress: number;
  simulationWeeks: number;
  onSkip: () => void;
}) {
  const currentWeek = Math.max(1, Math.ceil(progress * simulationWeeks));
  const currentDay = Math.max(1, Math.ceil(progress * simulationWeeks * 7));
  return (
    <Card className="gap-0 p-[23px] max-[700px]:p-[18px]" aria-live="polite">
      <div className="flex items-center gap-[10px] text-brand-blue max-[700px]:flex-wrap max-[700px]:gap-[7px]">
        <Sparkles size={20} />
        <strong className="text-[14px] max-[700px]:text-[12px]">
          {mitigating ? "Un anticipo cambia la historia" : scenarioTitle}
        </strong>
        <Button
          variant="ghost"
          className="ml-auto gap-[7px] py-[10px] text-[12px] max-[700px]:text-[11px]"
          onClick={onSkip}
        >
          Ver resultado <ArrowRight size={15} />
        </Button>
      </div>
      <p className="my-5 text-[13px] text-body-muted max-[700px]:leading-[1.7]">
        {mitigating
          ? "El anticipo de 25% regresa los soportes a su posición y reduce la brecha."
          : isContract
            ? phase
            : progress < 0.6
              ? "Proyectamos cobros y obligaciones de las próximas semanas…"
              : "Evaluamos el efecto sobre tu liquidez."}
      </p>
      <Progress value={progress * 100} className="h-[5px]" />
      <div className="mt-3 flex items-center justify-between border border-hairline bg-surface-subtle px-3 py-2 text-[11px]">
        <span className="text-body-muted">Timelapse sintético</span>
        <strong className={currentDay >= 75 ? "text-warning" : "text-body"}>
          Semana {currentWeek} · Día {currentDay}
        </strong>
      </div>
      <div className="mt-[15px] flex justify-between text-[12px] text-body-subtle max-[700px]:text-[10px]">
        <span>01 · Decisión</span>
        <span>02 · Flujo de caja</span>
        <span>03 · Estabilidad</span>
      </div>
    </Card>
  );
}
