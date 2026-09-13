import { CompanyProfileGaps } from "@features/company-picker";
import { SurvivalIndicator } from "@features/survival-indicator";
import { DecisionSandbox } from "@features/decision-sandbox";
import { TensionRadar } from "@features/tension-radar";
import { MinimumReinforcement } from "@features/minimum-reinforcement";
import { LimitationsStrip } from "@features/limitations-strip";
import type { AnalysisController } from "./useAnalysis";

/** The single view of PRD 3: five horizontal cards stacked in a vertical
 *  reading sequence, each laid out left to right. The page title and the
 *  breadcrumb live in the application shell that wraps this view.
 *
 *  Every figure on this page comes from a state document the engine produced.
 *  Nothing here derives a state, interpolates a value, or rounds in a way that
 *  changes a number: the interface selects, formats and presents. */
export default function AnalysisPage({
  analysis,
}: {
  analysis: AnalysisController;
}) {
  const { document, origin, reason } = analysis.result;
  const dimmed = analysis.pending || document.state_id === "abstention";

  return (
    <main className="p-[0_32px_48px] max-[1000px]:p-[0_16px_40px]">
      <p className="mb-7 max-w-[62ch] text-[13px] leading-[1.7] text-body-muted max-[700px]:text-[11px]">
        Cuántas semanas aguantas, qué obligación queda descubierta y cuál es la
        acción mínima que la evita. Las cifras se calculan con tus propios
        números sobre un horizonte de {document.horizon_days} días.
      </p>

      {/* The identifiers are the scroll targets the application shell's sidebar
          navigates to; they wrap the modules rather than reaching inside them. */}
      <div className="flex flex-col gap-5">
        <CompanyProfileGaps
          companyId={analysis.companyId}
          declared={analysis.declared}
          running={analysis.pending}
          abstaining={document.state_id === "abstention"}
          onDeclare={analysis.setDeclared}
        />
        <div id="supervivencia">
          <SurvivalIndicator document={document} pending={dimmed} />
        </div>
        <div id="simulador">
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
        </div>
        <div id="tension">
          <TensionRadar document={document} pending={dimmed} />
        </div>
        <div id="refuerzo">
          <MinimumReinforcement document={document} pending={dimmed} />
        </div>
        <div id="limitaciones">
          <LimitationsStrip
            document={document}
            origin={origin}
            reason={reason}
            pending={analysis.pending}
          />
        </div>
      </div>
    </main>
  );
}
