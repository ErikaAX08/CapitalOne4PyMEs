import { Database, RotateCcw, WifiOff } from "lucide-react";
import {
  LedgerSummary,
  MovementForm,
  MovementList,
  PendingQueue,
  type MovementsState,
} from "@features/movements-ledger";
import { Button } from "@shared";

/** The company's ledger: the `movements` table of docs/data-model.md §3, read
 *  from and written to `/v1/movements`.
 *
 *  Reading degrades to a bundled fixture and says so, the way `/analysis` does.
 *  Writing never degrades: a movement is stored or it is queued as unsent, and
 *  the interface never implies a figure reached the database when it did not. */
export default function MovementsPage({
  movements: state,
  cutoffDate,
}: {
  movements: MovementsState;
  cutoffDate: string;
}) {
  const degraded = state.origin === "fallback" && !state.loading;
  const reasonText =
    state.reason === "timeout"
      ? "el servicio tardó más de lo previsto"
      : state.reason === "unavailable"
        ? "el servicio no está disponible"
        : "no hay conexión con el servicio";

  return (
    <main className="p-[0_32px_48px] max-[1000px]:p-[0_16px_40px]">
      <p className="mb-6 max-w-[62ch] text-[13px] leading-[1.7] text-body-muted max-[700px]:text-[11px]">
        Cada entrada y cada salida con su fecha, su categoría y su estado. Es el
        libro de la empresa: lo que registres aquí se guarda, a diferencia de
        los gastos simulados del panel.
      </p>

      <div
        className={`mb-5 flex items-center gap-[10px] rounded-lg border p-[11px_14px] text-[11px] leading-[1.6] ${
          degraded
            ? "border-warning/40 bg-warning-soft/40"
            : "border-hairline bg-surface-subtle"
        }`}
        role="status"
        aria-live="polite"
      >
        {degraded ? (
          <WifiOff size={16} className="shrink-0 text-warning" />
        ) : (
          <Database size={16} className="shrink-0 text-brand-blue" />
        )}
        <span className="flex-1 text-ink">
          {state.loading ? (
            "Consultando el libro de la empresa…"
          ) : degraded ? (
            <>
              <strong className="font-semibold">Libro aproximado</strong> —{" "}
              {reasonText}, así que se muestran movimientos de ejemplo. No
              podrás guardar hasta que vuelva la conexión.
            </>
          ) : (
            <>
              Movimientos guardados en la base de datos · corte al {cutoffDate}
            </>
          )}
        </span>
        <Button
          variant="ghost"
          size="compact"
          className="shrink-0 gap-[6px] text-[11px]"
          onClick={state.refresh}
          disabled={state.loading}
        >
          <RotateCcw size={14} /> Actualizar
        </Button>
      </div>

      {/* The identifiers are the scroll targets the shell's sidebar navigates to. */}
      <div className="grid items-start gap-5 min-[1001px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <div id="resumen-libro">
            <LedgerSummary movements={state.movements} />
          </div>
          <section id="lista-movimientos" aria-label="Lista de movimientos">
            <MovementList movements={state.movements} loading={state.loading} />
          </section>
        </div>
        <div className="flex flex-col gap-5 min-[1001px]:sticky min-[1001px]:top-5">
          <div id="registrar">
            <MovementForm
              cutoffDate={cutoffDate}
              saving={state.saving}
              rejection={state.rejection}
              onAdd={state.add}
            />
          </div>
          <PendingQueue
            pending={state.pending}
            saving={state.saving}
            onRetry={state.retry}
            onDiscard={state.discard}
          />
        </div>
      </div>
    </main>
  );
}
