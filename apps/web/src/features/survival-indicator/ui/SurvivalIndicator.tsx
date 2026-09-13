import { InfoTooltip, cn, formatMoney } from "@shared";
import type { StateDocument } from "@entities/analysis";
import { toneFor, weeksText } from "../model/presentation";

/** Module A -- Survival indicator (PRD 3.1).
 *
 *  Answers "how long can I hold out?" in under two seconds of reading: weeks on
 *  the left, state in the middle, and on the right the concrete obligation that
 *  goes uncovered, with its date and amount. */
export function SurvivalIndicator({
  document,
  pending,
}: {
  document: StateDocument;
  pending: boolean;
}) {
  const survival = document.survival;
  const tone = toneFor(document.state_id);

  if (!survival) {
    return (
      <section
        aria-labelledby="survival-heading"
        className="flex min-h-[160px] items-center gap-6 rounded-xl border border-hairline bg-canvas p-[24px_28px] opacity-60 max-[900px]:flex-col max-[900px]:items-start max-[900px]:gap-4"
      >
        <h2 id="survival-heading" className="sr-only">
          Indicador de supervivencia
        </h2>
        <span
          className={cn("h-[92px] w-[6px] shrink-0 rounded-full", tone.bar)}
        />
        <p className="text-[13px] text-body-muted">{document.explanation}</p>
      </section>
    );
  }

  const first = survival.first_obligation;

  return (
    <section
      aria-labelledby="survival-heading"
      className={cn(
        "flex min-h-[160px] items-center gap-7 rounded-xl border border-hairline bg-canvas p-[24px_28px] transition-opacity duration-[400ms] ease-out max-[900px]:flex-col max-[900px]:items-start max-[900px]:gap-4",
        pending && "opacity-55",
      )}
    >
      <h2 id="survival-heading" className="sr-only">
        Indicador de supervivencia
      </h2>

      <span
        aria-hidden="true"
        className={cn(
          "h-[92px] w-[6px] shrink-0 rounded-full transition-colors duration-[400ms] ease-out max-[900px]:h-[6px] max-[900px]:w-[92px]",
          tone.bar,
        )}
      />

      <div className="shrink-0">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-title text-[76px] leading-[0.9] font-semibold tabular-nums tracking-[-0.04em] transition-colors duration-[400ms] ease-out max-[700px]:text-[56px]",
              tone.text,
            )}
          >
            {weeksText(survival.weeks, survival.upper_bounded)}
          </span>
          <span className="text-[13px] font-medium text-body-muted">
            semanas
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="font-mono text-[11px] tracking-normal text-body-muted uppercase">
            Supervivencia
          </span>
          <InfoTooltip label="Cómo se calculan las semanas de supervivencia">
            {document.definitions.survival_weeks}
          </InfoTooltip>
        </div>
      </div>

      <div className="h-[76px] w-px shrink-0 bg-hairline max-[900px]:hidden" />

      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "mb-2.5 inline-flex min-h-6 w-fit items-center rounded-full border px-2.5 py-1 font-title text-xs font-medium tracking-normal transition-colors duration-[400ms] ease-out",
            tone.chip,
          )}
        >
          {survival.state_label}
        </span>
        <p className="text-[15px] leading-[1.55] text-body">
          {survival.headline}
        </p>
        {first && (
          <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-2">
            <Field term="Obligación" value={first.label} />
            <Field term="Fecha" value={first.date_text} />
            <Field
              term="Faltante"
              value={formatMoney(first.gap_cents / 100)}
              emphasis={tone.text}
            />
          </dl>
        )}
      </div>
    </section>
  );
}

function Field({
  term,
  value,
  emphasis,
}: {
  term: string;
  value: string;
  emphasis?: string;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] tracking-normal text-body-subtle uppercase">
        {term}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-[13px] font-semibold tabular-nums",
          emphasis ?? "text-body",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
