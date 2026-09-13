import {
  clampToSpec,
  type ParameterSpec,
  type ParameterValue,
} from "@entities/analysis";
import { cn } from "@shared";
import { formatValue, markOffset } from "../model/format";

/** One control, generated from its schema entry.
 *
 *  Nothing here is written per decision: the type chooses the widget, and the
 *  bounds, step, default and mark all come from
 *  contracts/actions.schema.json -- the same file the backend validates
 *  against. Adding a decision adds controls without touching this component. */
export function ParameterControl({
  spec,
  value,
  disabled,
  onChange,
}: {
  spec: ParameterSpec;
  value: ParameterValue;
  disabled: boolean;
  onChange: (value: ParameterValue) => void;
}) {
  if (spec.type === "boolean") {
    const checked = Boolean(value);
    return (
      <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
        <span className="text-[12px] font-medium text-body">{spec.label}</span>
        <span className="relative inline-flex">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span
            aria-hidden="true"
            className="h-5 w-9 rounded-full bg-hairline-strong/40 transition-colors duration-200 peer-checked:bg-brand-blue peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-surface-subtle shadow-geist-small transition-transform duration-200 peer-checked:translate-x-4"
          />
        </span>
      </label>
    );
  }

  const numeric = typeof value === "number" ? value : 0;
  const min = spec.min ?? 0;
  const max = spec.max ?? 100;
  const step = spec.step ?? 1;
  const mark = spec.mark;

  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={`param-${spec.id}`}
          className="text-[12px] font-medium text-body"
        >
          {spec.label}
        </label>
        <output
          htmlFor={`param-${spec.id}`}
          className="font-mono text-[12px] font-semibold tabular-nums text-ink"
        >
          {formatValue(spec, numeric)}
        </output>
      </div>

      <div className="relative mt-2">
        <input
          id={`param-${spec.id}`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={numeric}
          disabled={disabled}
          aria-describedby={mark ? `mark-${spec.id}` : undefined}
          onChange={(event) =>
            onChange(clampToSpec(spec, Number(event.target.value)))
          }
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-hairline accent-brand-blue disabled:cursor-wait"
        />
        {mark && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-danger"
            style={{ left: `${markOffset(spec, mark.value)}%` }}
          />
        )}
      </div>

      {mark && (
        <p
          id={`mark-${spec.id}`}
          className="mt-1.5 flex items-center gap-1.5 text-[10px] text-body-subtle"
        >
          <span aria-hidden="true" className="h-2 w-px bg-danger" />
          {formatValue(spec, mark.value)} · {mark.text}
        </p>
      )}
      {spec.hint && !mark && (
        <p className="mt-1.5 text-[10px] text-body-subtle">{spec.hint}</p>
      )}
      <span className={cn("sr-only")}>
        Entre {formatValue(spec, min)} y {formatValue(spec, max)}
      </span>
    </div>
  );
}
