import { useEffect, useState } from "react";
import type { SimulationOutput } from "@entities/simulation";
import { formatMoney } from "@shared";

type View = "actual" | "decision" | "reinforcement";

export function ScenarioComparator({
  current,
  decision,
  reinforcement,
  reinforced,
}: {
  current: SimulationOutput;
  decision: SimulationOutput;
  reinforcement: SimulationOutput;
  reinforced: boolean;
}) {
  const [view, setView] = useState<View>(reinforced ? "reinforcement" : "decision");
  useEffect(() => setView(reinforced ? "reinforcement" : "decision"), [reinforced]);
  const selected =
    view === "actual" ? current : view === "decision" ? decision : reinforcement;
  return (
    <section aria-label="Comparar escenarios" className="mt-4 border-t border-hairline pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-ink">Comparar escenarios</h3>
        <span className="text-[10px] text-body-muted">Mismo horizonte</span>
      </div>
      <div className="mt-3 grid grid-cols-3 rounded-lg bg-surface-muted p-1" role="tablist">
        {([
          ["actual", "Actual"],
          ["decision", "Con decisión"],
          ["reinforcement", "Con refuerzo"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`min-h-9 rounded-md px-2 text-[10px] font-medium transition-colors ${view === id ? "bg-canvas text-ink shadow-geist-small" : "text-body-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-body-muted">
        <div><dt>Saldo mínimo</dt><dd className="mt-1 text-xs font-semibold text-ink">{formatMoney(selected.minimumProjectedBalance)}</dd></div>
        <div><dt>Cobertura</dt><dd className="mt-1 text-xs font-semibold text-ink">{selected.survivalWeeks} semanas</dd></div>
        <div><dt>Fragilidad</dt><dd className="mt-1 text-xs font-semibold text-ink">{selected.fragilityScore}/100</dd></div>
      </dl>
    </section>
  );
}
