import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  dateText,
  isOpen,
  nodeLabel,
  outstandingCents,
  sourceLabel,
  statusLabel,
  statusVariant,
  type Movement,
} from "@entities/business";
import { Badge, Card, cn, formatMoney } from "@shared";

/** The company's ledger: every dated receipt and obligation, most recent first.
 *
 *  Amounts are read from `amountCents`; nothing here recomputes a figure, and a
 *  partially reconciled movement shows what is still outstanding next to the
 *  contractual amount rather than replacing it. */
export function MovementList({
  movements,
  loading,
}: {
  movements: Movement[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="p-[22px]" role="status" aria-live="polite">
        <p className="text-[13px] text-body-muted">Cargando movimientos…</p>
      </Card>
    );
  }
  if (movements.length === 0) {
    return (
      <Card className="p-[22px]">
        <p className="text-[13px] text-body-muted">
          Todavía no hay movimientos registrados. El primero que guardes
          aparecerá aquí.
        </p>
      </Card>
    );
  }
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <ol className="m-0 list-none divide-y divide-hairline p-0">
        {movements.map((movement) => {
          const incoming = movement.direction === "in";
          const outstanding = outstandingCents(movement);
          const partly = outstanding !== movement.amountCents;
          return (
            <li
              key={movement.id}
              className="flex items-center gap-[14px] p-[14px_20px] max-[700px]:gap-[11px] max-[700px]:p-[12px_15px]"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                  incoming
                    ? "bg-brand-blue-soft text-brand-blue"
                    : "bg-surface-muted text-body-muted",
                )}
              >
                {incoming ? (
                  <ArrowDownLeft size={17} />
                ) : (
                  <ArrowUpRight size={17} />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <strong className="truncate text-[13px] font-semibold text-ink">
                    {movement.description || nodeLabel(movement.node)}
                  </strong>
                  <Badge
                    variant={statusVariant(movement.status)}
                    className="h-auto shrink-0 px-[8px] py-[3px] text-[10px] font-medium"
                  >
                    {statusLabel(movement.status)}
                  </Badge>
                </div>
                <small className="mt-1 block text-[11px] text-body-muted">
                  {nodeLabel(movement.node)} · {dateText(movement.dueDate)}
                  <span className="max-[700px]:hidden">
                    {" "}
                    · {sourceLabel(movement.source)}
                  </span>
                </small>
              </div>

              <div className="shrink-0 text-right">
                <strong
                  className={cn(
                    "block text-[14px] font-semibold tabular-nums",
                    incoming ? "text-brand-blue" : "text-ink",
                  )}
                >
                  {incoming ? "+" : "−"}
                  {formatMoney(movement.amountCents / 100)}
                </strong>
                {partly && isOpen(movement) && (
                  <small className="mt-0.5 block text-[10px] text-body-muted">
                    Pendiente {formatMoney(outstanding / 100)}
                  </small>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
