import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SurvivalIndicator } from "@features/survival-indicator";
import { DecisionSandbox } from "@features/decision-sandbox";
import { TensionRadar } from "@features/tension-radar";
import { MinimumReinforcement } from "@features/minimum-reinforcement";
import { LimitationsStrip } from "@features/limitations-strip";
import { useAnalysis } from "./useAnalysis";

/** The single view of PRD 3: five horizontal cards stacked in a vertical
 *  reading sequence, each laid out left to right.
 *
 *  Every figure on this page comes from a state document the engine produced.
 *  Nothing here derives a state, interpolates a value, or rounds in a way that
 *  changes a number: the interface selects, formats and presents. */
export default function AnalysisPage() {
  const analysis = useAnalysis();
  const { document, origin, reason } = analysis.result;
  const dimmed = analysis.pending || document.state_id === "abstention";

  return (
    <main className="mx-auto max-w-[1440px] p-[40px_max(5vw,24px)_56px] max-[700px]:p-[24px_16px_40px]">
      <header className="mb-7">
        <nav className="font-mono mb-3 flex items-center gap-2 text-xs font-medium tracking-normal text-body-muted uppercase max-[700px]:text-[11px]">
          <Link to="/dashboard" className="no-underline hover:underline">
            Mi negocio
          </Link>
          <ChevronRight size={12} aria-hidden="true" />
          Fragilidad estructural
        </nav>
        <h1 className="font-title text-[2rem] leading-10 font-semibold tracking-[-0.04em] max-[700px]:text-2xl max-[700px]:leading-8">
          Antes de decidir,{" "}
          <span className="font-subtitle font-semibold text-body-subtle">
            mira qué se debilita.
          </span>
        </h1>
        <p className="mt-[9px] max-w-[62ch] text-[13px] leading-[1.7] text-body-muted max-[700px]:text-[11px]">
          Cuántas semanas aguantas, qué obligación queda descubierta y cuál es
          la acción mínima que la evita. Las cifras se calculan con tus propios
          números sobre un horizonte de {document.horizon_days} días.
        </p>
      </header>

      <div className="flex flex-col gap-5">
        <SurvivalIndicator document={document} pending={dimmed} />
        <DecisionSandbox
          action={analysis.action}
          parameters={analysis.parameters}
          stress={analysis.stress}
          running={analysis.pending}
          onActionChange={analysis.setAction}
          onParameterChange={analysis.setParameter}
          onStressChange={analysis.setStress}
          onRun={analysis.run}
          onReset={analysis.reset}
        />
        <TensionRadar document={document} pending={dimmed} />
        <MinimumReinforcement document={document} pending={dimmed} />
        <LimitationsStrip
          document={document}
          origin={origin}
          reason={reason}
          pending={analysis.pending}
        />
      </div>
    </main>
  );
}
