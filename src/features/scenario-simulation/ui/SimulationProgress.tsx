import { ArrowRight, Sparkles } from "lucide-react";
import { Card, Progress, Button } from "@shared";
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
    <Card className="gap-0 p-[23px] max-[700px]:p-[18px]" aria-live="polite">
      <div className="flex items-center gap-[10px] text-brand-blue max-[700px]:flex-wrap max-[700px]:gap-[7px]">
        <Sparkles size={20} />
        <strong className="text-[14px] max-[700px]:text-[12px]">
          {mitigating ? "Un anticipo cambia la historia" : scenarioTitle}
        </strong>
        <Button
          variant="tertiary"
          className="ml-auto gap-[7px] py-[10px] text-[12px] max-[700px]:text-[11px]"
          onClick={onSkip}
        >
          Ver resultado <ArrowRight size={15} />
        </Button>
      </div>
      <p className="my-5 text-[13px] text-body-muted max-[700px]:leading-[1.7]">
        {mitigating
          ? "El 40% de anticipo refuerza las primeras semanas."
          : isContract
            ? phase
            : progress < 0.6
              ? "Proyectamos cobros y obligaciones de las próximas semanas…"
              : "Evaluamos el efecto sobre tu liquidez."}
      </p>
      <Progress value={progress * 100} className="h-[5px]" />
      <div className="mt-[15px] flex justify-between text-[12px] text-body-subtle max-[700px]:text-[10px]">
        <span>01 · Decisión</span>
        <span>02 · Flujo de caja</span>
        <span>03 · Estabilidad</span>
      </div>
    </Card>
  );
}
