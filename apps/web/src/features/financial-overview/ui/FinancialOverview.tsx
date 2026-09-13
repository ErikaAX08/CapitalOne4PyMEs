import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Clock3, ShieldCheck, TrendingDown, Wallet } from "lucide-react";
import { formatMoney, Badge, cn } from "@shared";

/** One statistic of the base state. The highlighted variant carries the figure
 *  the rest of the view is read against, so it is filled with the brand blue. */
function StatTile({
  icon: Icon,
  label,
  chip,
  value,
  unit,
  footnote,
  highlighted = false,
  className,
  children,
}: {
  icon: LucideIcon;
  label: string;
  chip?: ReactNode;
  value: string;
  unit?: string;
  footnote: string;
  highlighted?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl border p-[18px_20px] shadow-geist-small max-[700px]:p-[15px_16px]",
        highlighted
          ? "border-brand-blue bg-brand-blue text-on-brand"
          : "border-hairline bg-surface-subtle",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            highlighted
              ? "bg-on-brand/15 text-on-brand"
              : "bg-surface-muted text-brand-blue",
          )}
        >
          <Icon size={18} />
        </span>
        {chip}
      </div>
      <span
        className={cn(
          "mt-[15px] text-[12px]",
          highlighted ? "text-on-brand/75" : "text-body-muted",
        )}
      >
        {label}
      </span>
      <strong className="font-title mt-[5px] block text-[30px] leading-[1.15] font-semibold tracking-[-0.02em] tabular-nums max-[700px]:text-[25px]">
        {value}
        {unit && (
          <small
            className={cn(
              "ml-[4px] text-[13px] font-normal",
              highlighted ? "text-on-brand/70" : "text-body-subtle",
            )}
          >
            {unit}
          </small>
        )}
      </strong>
      {children}
      <span
        className={cn(
          "mt-auto pt-[11px] text-[11px] leading-[1.5]",
          highlighted ? "text-on-brand/70" : "text-body-muted",
        )}
      >
        {footnote}
      </span>
    </div>
  );
}

/** Module A of the dashboard: the four figures of the base state, laid out as
 *  the statistics row the view is read from top to bottom. */
export function FinancialOverview({
  availableBalance,
  hasExpenses,
  expenseTotal,
  fragilityScore,
  survivalWeeks,
  recommendedBuffer,
}: {
  availableBalance: number;
  hasExpenses: boolean;
  expenseTotal: number;
  fragilityScore: number;
  survivalWeeks: number;
  recommendedBuffer: number;
}) {
  const statusVariant =
    fragilityScore >= 70
      ? "danger"
      : fragilityScore >= 40
        ? "warning"
        : "success";
  return (
    <section
      id="resumen"
      aria-label="Resumen financiero"
      className="grid grid-cols-2 gap-4 max-[700px]:gap-[10px] min-[1001px]:grid-cols-4"
    >
      <StatTile
        highlighted
        icon={Wallet}
        label="Saldo disponible"
        value={formatMoney(availableBalance)}
        unit="MXN"
        className="max-[700px]:col-span-2"
        chip={
          hasExpenses ? (
            <span className="rounded-full bg-on-brand/15 px-[9px] py-[5px] text-[11px] font-medium text-on-brand">
              −{formatMoney(expenseTotal)}
            </span>
          ) : undefined
        }
        footnote={
          hasExpenses
            ? "Saldo después de los gastos simulados"
            : "Operación actual · antes de la decisión"
        }
      />
      <StatTile
        icon={TrendingDown}
        label="Fragilidad de la operación"
        value={String(fragilityScore)}
        unit="/100"
        className="max-[700px]:col-span-2"
        chip={
          <Badge
            variant={statusVariant}
            className="h-auto gap-[6px] px-[10px] py-[5px] text-[11px] font-medium"
          >
            <span className="h-[5px] w-[5px] rounded-full bg-current" />
            {fragilityScore >= 70
              ? "Crítico"
              : fragilityScore >= 40
                ? "Precaución"
                : "Estable"}
          </Badge>
        }
        footnote="Más alto, más vulnerable"
      >
        <div className="relative mt-[13px] h-[5px] bg-surface-muted">
          <div
            style={{ width: `${fragilityScore}%` }}
            className="h-full bg-brand-blue transition-[width] duration-100"
          />
          <i
            style={{ left: `${fragilityScore}%` }}
            className="absolute top-[-3px] h-[11px] w-[2px] -translate-x-1/2 border border-canvas bg-ink transition-[left] duration-100"
          />
        </div>
      </StatTile>
      <StatTile
        icon={Clock3}
        label="Tiempo de cobertura"
        value={String(survivalWeeks)}
        unit="semanas"
        footnote="Antes de agotar liquidez"
      />
      <StatTile
        icon={ShieldCheck}
        label="Reserva sugerida"
        value={formatMoney(recommendedBuffer)}
        unit="MXN"
        footnote="Para absorber imprevistos"
      />
    </section>
  );
}
