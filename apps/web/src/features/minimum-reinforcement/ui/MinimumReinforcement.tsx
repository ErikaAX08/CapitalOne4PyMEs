import { ArrowRight } from "lucide-react";
import { InfoTooltip, cn } from "@shared";
import type { StateDocument } from "@entities/analysis";
import { PropagationPath } from "./PropagationPath";

/** Module D -- Minimum reinforcement and propagation path (PRD 3.4).
 *
 *  Closes the loop: an interface that explains the problem and leaves the user
 *  without a way out does not fulfil the product promise. Both columns come
 *  from the same parameterization over the same Monte Carlo worlds; comparing
 *  different worlds would invalidate the comparison. */
export function MinimumReinforcement({
  document,
  pending,
}: {
  document: StateDocument;
  pending: boolean;
}) {
  const reinforcement = document.minimum_reinforcement;
  const path = document.propagation_path;

  return (
    <section
      aria-labelledby="reinforcement-heading"
      className={cn(
        "rounded-xl border border-hairline bg-canvas p-[24px_28px] transition-opacity duration-[400ms] ease-out",
        pending && "opacity-55",
      )}
    >
      <div className="mb-5 flex items-center gap-1.5">
        <h2
          id="reinforcement-heading"
          className="font-mono text-[11px] tracking-normal text-body-muted uppercase"
        >
          Refuerzo mínimo y ruta de propagación
        </h2>
        <InfoTooltip label="Qué es la frecuencia de brecha">
          {document.definitions.gap_frequency}
        </InfoTooltip>
      </div>

      <div className="grid grid-cols-2 gap-8 max-[900px]:grid-cols-1 max-[900px]:gap-6">
        <div className="min-w-0">
          {reinforcement ? (
            <>
              <p className="text-[15px] leading-[1.5] font-semibold text-ink">
                {reinforcement.label}
              </p>
              {reinforcement.found !== false && (
                <table className="mt-4 w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="py-1.5 text-left font-mono text-[10px] font-normal tracking-normal text-body-subtle uppercase">
                        &nbsp;
                      </th>
                      <th className="py-1.5 text-right font-mono text-[10px] font-normal tracking-normal text-body-subtle uppercase">
                        Antes
                      </th>
                      <th className="w-6" />
                      <th className="py-1.5 text-right font-mono text-[10px] font-normal tracking-normal text-body-subtle uppercase">
                        Después
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <Row
                      term="Frecuencia de brecha"
                      before={percent(reinforcement.before.gap_frequency)}
                      after={percent(reinforcement.gap_frequency_after)}
                    />
                    <Row
                      term="Semanas de supervivencia"
                      before={weeks(
                        reinforcement.before.weeks,
                        reinforcement.before.upper_bounded,
                      )}
                      after={weeks(
                        reinforcement.weeks_after,
                        reinforcement.upper_bounded_after,
                      )}
                    />
                    <Row
                      term="Estado"
                      before={reinforcement.before.state_label}
                      after={reinforcement.state_label_after ?? "—"}
                    />
                  </tbody>
                </table>
              )}
              {reinforcement.found === false && (
                <p className="mt-3 text-[12px] text-body-muted">
                  La búsqueda recorrió{" "}
                  {reinforcement.grid_points_evaluated ?? 0} puntos de la malla
                  sin encontrar un refuerzo que cierre la brecha.
                </p>
              )}
            </>
          ) : (
            <p className="text-[13px] text-body-muted">
              No hay decisión que reforzar: esta es la operación actual.
            </p>
          )}
        </div>

        <div className="min-w-0">
          {path ? (
            <PropagationPath path={path} />
          ) : (
            <p className="text-[13px] text-body-muted">
              Sin ruta de propagación en este estado.
            </p>
          )}
          <p className="mt-4 border-t border-hairline pt-4 text-[13px] leading-[1.6] text-body">
            {document.explanation}
          </p>
        </div>
      </div>
    </section>
  );
}

function Row({
  term,
  before,
  after,
}: {
  term: string;
  before: string;
  after: string;
}) {
  const changed = before !== after;
  return (
    <tr className="border-b border-hairline/70 last:border-0">
      <th scope="row" className="py-2 text-left font-normal text-body-muted">
        {term}
      </th>
      <td className="py-2 text-right font-mono tabular-nums text-body">
        {before}
      </td>
      <td className="py-2 text-center">
        <ArrowRight
          size={12}
          aria-hidden="true"
          className={changed ? "text-brand-blue" : "text-hairline-strong"}
        />
      </td>
      <td
        className={cn(
          "py-2 text-right font-mono font-semibold tabular-nums",
          changed ? "text-brand-blue" : "text-body",
        )}
      >
        {after}
      </td>
    </tr>
  );
}

function percent(value: number | undefined): string {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—";
}

function weeks(value: number | undefined, upperBounded: boolean | undefined) {
  if (typeof value !== "number") return "—";
  return upperBounded ? `> ${value}` : String(value);
}
