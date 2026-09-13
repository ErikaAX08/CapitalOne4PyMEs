import { ChevronDown } from "lucide-react";

export function AssumptionsPanel({ simulationWeeks }: { simulationWeeks: number }) {
  return (
    <details className="group rounded-xl border border-hairline bg-surface-subtle p-4 text-xs text-body-muted">
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-ink">
        Supuestos y alcance de esta vista
        <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-2 border-t border-hairline pt-3 text-[11px] leading-5">
        <p>Horizonte: {simulationWeeks} semanas. Los importes y fechas pertenecen al entorno de demostración.</p>
        <p>La torre representa el resultado del simulador; no calcula el riesgo por sí misma.</p>
        <p>Las probabilidades de Monte Carlo dependen de los supuestos y se muestran separadas del riesgo predictivo.</p>
      </div>
    </details>
  );
}
