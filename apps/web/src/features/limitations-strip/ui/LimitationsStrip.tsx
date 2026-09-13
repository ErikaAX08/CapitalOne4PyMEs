import { CloudOff, Loader2 } from "lucide-react";
import { cn } from "@shared";
import type { FallbackReason, Origin, StateDocument } from "@entities/analysis";

const FALLBACK_REASONS: Record<FallbackReason, string> = {
  timeout: "el motor tardó más de 3 s",
  network: "sin conexión con el motor",
  server_error: "el motor devolvió un error",
  unknown_schema: "el motor devolvió un esquema desconocido",
};

/** Module E -- Scope and limitations strip (PRD 3.5).
 *
 *  Declaring the limits conveys more rigour than hiding them, and this strip is
 *  the mechanism that protects against the forbidden claims of PRD 2.2. Every
 *  code in `warnings` renders here: a non-empty array that does not appear on
 *  screen is a defect, not an aesthetic omission. */
export function LimitationsStrip({
  document,
  origin,
  reason,
  pending,
}: {
  document: StateDocument;
  origin: Origin;
  reason?: FallbackReason;
  pending: boolean;
}) {
  const approximate = origin === "fallback";

  return (
    <section
      aria-label="Alcance y limitaciones"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-[14px_20px] text-[11px] transition-colors duration-[400ms] ease-out",
        document.state_id === "abstention"
          ? "border-hairline-strong/40 bg-surface-muted text-body"
          : "border-hairline bg-surface-soft text-body-subtle",
      )}
    >
      {approximate && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-tension/25 bg-tension-soft px-2.5 py-1 font-medium text-warning">
          <CloudOff size={11} aria-hidden="true" />
          Escenario aproximado
          {reason && (
            <span className="font-normal">· {FALLBACK_REASONS[reason]}</span>
          )}
        </span>
      )}

      {document.notices.map((notice) => (
        <span
          key={notice.code}
          className="rounded-full border border-hairline bg-surface-subtle px-2.5 py-1"
        >
          {notice.label}
        </span>
      ))}

      <span className="font-mono ml-auto tracking-normal tabular-nums">
        Semilla {document.seed} · Motor {document.engine_version} · Esquema{" "}
        {document.schema}
        {document.simulation &&
          ` · ${document.simulation.paths.toLocaleString("es-MX")} futuros`}
      </span>
    </section>
  );
}
