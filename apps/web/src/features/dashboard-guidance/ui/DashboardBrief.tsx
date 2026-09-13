import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import type { SimulationOutput } from "@entities/simulation";
import { formatMoney } from "@shared";

export function DashboardBrief({
  balance,
  output,
  hasScenario,
}: {
  balance: number;
  output: SimulationOutput;
  hasScenario: boolean;
}) {
  const needsAttention = output.minimumProjectedBalance < 0;
  const conclusion = hasScenario
    ? needsAttention
      ? "Esta decisión abre una brecha antes del siguiente cobro."
      : "La operación conserva liquidez con esta decisión."
    : "Tu operación está estable; la nómina es el siguiente compromiso que debes vigilar.";

  return (
    <section
      aria-labelledby="dashboard-conclusion"
      className="grid gap-5 border-y border-hairline bg-surface-subtle p-[22px_24px] min-[850px]:grid-cols-[minmax(0,1.2fr)_minmax(420px,1fr)] min-[850px]:items-center max-[700px]:p-[18px_4px]"
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${needsAttention && hasScenario ? "bg-danger-soft text-danger" : "bg-brand-blue-soft text-brand-blue"}`}
        >
          {needsAttention && hasScenario ? (
            <TriangleAlert size={18} />
          ) : (
            <CircleCheck size={18} />
          )}
        </span>
        <div>
          <span className="font-mono text-[11px] font-medium uppercase text-body-muted">
            Lectura de hoy
          </span>
          <h2
            id="dashboard-conclusion"
            className="font-title mt-1 max-w-[680px] text-[22px] font-semibold leading-tight tracking-[-0.035em] text-ink max-[700px]:text-lg"
          >
            {conclusion}
          </h2>
          <a
            href="#decisiones"
            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-brand-blue no-underline"
          >
            {hasScenario ? "Revisar el resultado" : "Probar una decisión"}
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
      <dl className="grid grid-cols-3 divide-x divide-hairline rounded-xl border border-hairline bg-canvas py-3 shadow-geist-small">
        <div className="px-4 max-[500px]:px-2">
          <dt className="text-[10px] text-body-muted">Saldo hoy</dt>
          <dd className="mt-1 text-sm font-semibold text-ink max-[500px]:text-xs">
            {formatMoney(balance)}
          </dd>
        </div>
        <div className="px-4 max-[500px]:px-2">
          <dt className="text-[10px] text-body-muted">Cobertura</dt>
          <dd className="mt-1 text-sm font-semibold text-ink max-[500px]:text-xs">
            {output.survivalWeeks} semanas
          </dd>
        </div>
        <div className="px-4 max-[500px]:px-2">
          <dt className="text-[10px] text-body-muted">Estado</dt>
          <dd className="mt-1 text-sm font-semibold text-brand-blue max-[500px]:text-xs">
            {output.status}
          </dd>
        </div>
      </dl>
    </section>
  );
}
