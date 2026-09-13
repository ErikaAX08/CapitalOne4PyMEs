import { Fragment } from "react";
import { InfoTooltip, cn } from "@shared";
import type { StateDocument, TensionFactor } from "@entities/analysis";
import { barColor, computationText, sourceNote } from "../model/tooltip";

/** Module C -- Tension and attribution radar (PRD 3.3).
 *
 *  Six horizontal bars, already sorted descending by the engine, grouped by the
 *  stack of the universal graph. Tension is a normalisation of univariate
 *  tolerances, not a learned causal attribution, and the tooltip says so in
 *  those words. */
export function TensionRadar({
  document,
  pending,
}: {
  document: StateDocument;
  pending: boolean;
}) {
  const factors = document.tension;

  return (
    <section
      aria-labelledby="tension-heading"
      className={cn(
        "rounded-xl border border-hairline bg-canvas p-[24px_28px] transition-opacity duration-[400ms] ease-out",
        pending && "opacity-55",
      )}
    >
      <div className="mb-5 flex items-center gap-1.5">
        <h2
          id="tension-heading"
          className="font-mono text-[11px] tracking-normal text-body-muted uppercase"
        >
          Dónde se tensiona la estructura
        </h2>
        <InfoTooltip label="Cómo se calcula la tensión">
          {document.definitions.tension}
        </InfoTooltip>
      </div>

      {factors.length === 0 ? (
        <p className="text-[13px] text-body-muted">
          Sin atribución de tensión en este estado.
        </p>
      ) : (
        <ol className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3 max-[700px]:grid-cols-1 max-[700px]:gap-y-4">
          {factors.map((factor) => (
            <Bar key={factor.factor} factor={factor} />
          ))}
        </ol>
      )}
    </section>
  );
}

function Bar({ factor }: { factor: TensionFactor }) {
  const note = sourceNote(factor);
  const percentage = Math.round(factor.tension * 100);

  return (
    <Fragment>
      <li className="contents">
        <div className="flex min-w-0 flex-col justify-center max-[700px]:flex-row max-[700px]:items-baseline max-[700px]:gap-2">
          <span className="truncate text-[12px] font-medium text-body">
            {factor.label}
          </span>
          <span className="font-mono text-[10px] tracking-normal text-body-subtle uppercase">
            {factor.stack_label}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            role="meter"
            aria-valuenow={factor.tension}
            aria-valuemin={0}
            aria-valuemax={1}
            aria-label={`${factor.label}: tensión ${factor.tension.toFixed(2)}`}
            className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width,background-color] duration-[500ms] ease-out",
                barColor(factor.tension),
              )}
              style={{ width: `${Math.max(percentage, 1)}%` }}
            />
          </div>
          <InfoTooltip label={`Cómo se calcula ${factor.label}`} align="end">
            <span className="block font-medium">{factor.label}</span>
            <span className="mt-1 block font-mono text-[10px]">
              {computationText(factor)} = {factor.tension.toFixed(2)}
            </span>
            {note && (
              <span className="mt-1.5 block text-body-muted">{note}</span>
            )}
            {factor.search_bounded && (
              <span className="mt-1.5 block text-body-muted">
                Ninguna perturbación dentro del rango de búsqueda abrió una
                brecha: la tensión es una cota inferior.
              </span>
            )}
          </InfoTooltip>
        </div>

        <div className="flex items-baseline justify-end gap-2">
          <span className="font-mono text-[13px] font-semibold tabular-nums text-ink">
            {factor.tension.toFixed(2)}
          </span>
          {note === "Supuesto declarado" && (
            <span className="rounded-full border border-hairline px-1.5 py-0.5 text-[9px] text-body-subtle">
              supuesto
            </span>
          )}
        </div>
      </li>
    </Fragment>
  );
}
