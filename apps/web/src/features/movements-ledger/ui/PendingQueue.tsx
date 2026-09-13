import { RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { dateText, nodeLabel } from "@entities/business";
import { Button, Card, formatMoney } from "@shared";
import type { PendingMovement } from "../model/useMovements";

/** Movements the user recorded that never reached the database.
 *
 *  They are deliberately outside the ledger list: the work is kept so it is not
 *  lost, but nothing here is presented as stored. Each one can be retried or
 *  discarded, and the queue lives only in this session — a reload loses it,
 *  which the copy states rather than implying otherwise. */
export function PendingQueue({
  pending,
  saving,
  onRetry,
  onDiscard,
}: {
  pending: PendingMovement[];
  saving: boolean;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  if (pending.length === 0) return null;
  return (
    <Card
      className="gap-0 border-warning/40 bg-warning-soft/40 p-[18px_20px]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-[9px]">
        <TriangleAlert size={18} className="shrink-0 text-warning" />
        <strong className="text-[13px] font-semibold text-ink">
          {pending.length === 1
            ? "1 movimiento sin guardar"
            : `${pending.length} movimientos sin guardar`}
        </strong>
      </div>
      <p className="mt-[8px] text-[11px] leading-[1.7] text-body-muted">
        No se pudieron enviar al servicio y no están en el libro de la empresa.
        Se conservan solo en esta pestaña: si recargas, se pierden.
      </p>
      <ul className="mt-[14px] m-0 list-none space-y-[10px] p-0">
        {pending.map((entry) => (
          <li
            key={entry.id}
            className="rounded-lg border border-hairline bg-surface-subtle p-[12px_13px]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong className="block truncate text-[12px] font-semibold text-ink">
                  {entry.draft.description || nodeLabel(entry.draft.node)}
                </strong>
                <small className="mt-0.5 block text-[10px] text-body-muted">
                  {nodeLabel(entry.draft.node)} ·{" "}
                  {dateText(entry.draft.dueDate)}
                </small>
              </div>
              <strong className="shrink-0 text-[13px] font-semibold tabular-nums text-ink">
                {entry.draft.direction === "in" ? "+" : "−"}
                {formatMoney(entry.draft.amountCents / 100)}
              </strong>
            </div>
            <p className="mt-[8px] text-[10px] leading-[1.6] text-body-muted">
              {entry.error}
            </p>
            <div className="mt-[10px] flex gap-2">
              <Button
                variant="secondary"
                size="compact"
                className="gap-[6px] text-[11px]"
                disabled={saving}
                onClick={() => onRetry(entry.id)}
              >
                <RotateCcw size={14} /> Reintentar
              </Button>
              <Button
                variant="ghost"
                size="compact"
                className="gap-[6px] text-[11px]"
                onClick={() => onDiscard(entry.id)}
              >
                <Trash2 size={14} /> Descartar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
