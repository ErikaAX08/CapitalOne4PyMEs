import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
import { totals, type Movement } from "@entities/business";
import { cn, formatMoney } from "@shared";

/** What the open movements add up to. Settled and cancelled rows are excluded:
 *  they no longer move money (docs/data-model.md §4). */
export function LedgerSummary({ movements }: { movements: Movement[] }) {
  const { incoming, outgoing, net } = totals(movements);
  const tiles = [
    {
      icon: ArrowDownLeft,
      label: "Entradas pendientes",
      value: incoming,
      accent: "text-brand-blue",
    },
    {
      icon: ArrowUpRight,
      label: "Salidas pendientes",
      value: outgoing,
      accent: "text-ink",
    },
    {
      icon: Scale,
      label: "Diferencia",
      value: net,
      accent: net < 0 ? "text-danger" : "text-brand-blue",
    },
  ];
  return (
    <section
      aria-label="Resumen del libro"
      className="grid grid-cols-3 gap-4 max-[700px]:grid-cols-1 max-[700px]:gap-[10px]"
    >
      {tiles.map(({ icon: Icon, label, value, accent }) => (
        <div
          key={label}
          className="rounded-xl border border-hairline bg-surface-subtle p-[16px_18px] shadow-geist-small"
        >
          <span className="flex items-center gap-[7px] text-[11px] text-body-muted">
            <Icon size={15} /> {label}
          </span>
          <strong
            className={cn(
              "font-title mt-[9px] block text-[24px] font-semibold tracking-[-0.02em] tabular-nums",
              accent,
            )}
          >
            {formatMoney(value / 100)}
          </strong>
        </div>
      ))}
    </section>
  );
}
