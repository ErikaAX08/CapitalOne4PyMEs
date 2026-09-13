import { Building2, CircleHelp, Clock3, ShieldCheck } from "lucide-react";
import { formatMoney, Card, Badge } from "@shared";

export function FinancialOverview({
  availableBalance,
  hasExpenses,
  fragilityScore,
  survivalWeeks,
  recommendedBuffer,
  contextMessage,
}: {
  availableBalance: number;
  hasExpenses: boolean;
  fragilityScore: number;
  survivalWeeks: number;
  recommendedBuffer: number;
  contextMessage: string;
}) {
  const statusVariant =
    fragilityScore >= 70
      ? "danger"
      : fragilityScore >= 40
        ? "warning"
        : "success";
  return (
    <Card className="self-start gap-0 p-[24px_26px] max-[700px]:p-[15px] min-[701px]:p-[20px_24px]">
      <div className="flex items-center justify-between border-b border-hairline pb-[22px] text-[13px] font-semibold max-[700px]:pb-[11px] max-[700px]:text-[12px] min-[701px]:pb-[15px]">
        <span className="flex items-center gap-[9px]">
          <Building2 size={18} /> Distribuidora Luna
        </span>
        <span className="text-[11px] font-normal text-body-muted">
          12 empleados
        </span>
      </div>
      <div className="p-[22px_0_23px] max-[700px]:p-[12px_0] min-[701px]:p-[17px_0]">
        <span className="text-[12px] text-body-muted">Saldo disponible</span>
        <div className="font-title my-[5px] mb-[9px] text-[35px] font-semibold tracking-normal tabular-nums max-[700px]:my-[4px] max-[700px]:text-[27px]">
          {formatMoney(availableBalance)}{" "}
          <small className="text-[12px] font-medium tracking-normal text-body-subtle">
            MXN
          </small>
        </div>
        <span className="flex items-center gap-[5px] text-[12px] text-body-muted max-[700px]:hidden">
          <span className="h-[5px] w-[5px] rounded-full bg-success" />
          {hasExpenses
            ? "Saldo después de los gastos simulados"
            : "Operación actual · antes de la decisión"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-[12px] max-[700px]:grid-cols-[1.1fr_1fr_1fr] max-[700px]:gap-[7px]">
        <div className="col-span-2 min-w-0 rounded-lg border border-hairline bg-surface-muted/60 p-3 max-[700px]:col-span-1 max-[700px]:p-[10px]">
          <div className="flex items-center justify-between gap-[6px] text-[11px] text-body-muted max-[700px]:min-h-[28px] max-[700px]:gap-1 max-[700px]:text-[10px] max-[700px]:leading-[1.4]">
            Fragilidad de la operación{" "}
            <CircleHelp size={14} className="max-[700px]:hidden" />
          </div>
          <div className="my-[5px] mb-3 flex items-center justify-between max-[700px]:my-[2px] max-[700px]:mb-[9px] max-[700px]:block">
            <strong className="font-title text-[37px] font-semibold tracking-normal tabular-nums max-[700px]:text-[27px]">
              {fragilityScore}
              <small className="ml-[3px] text-[16px] font-normal text-body-subtle max-[700px]:inline max-[700px]:text-[11px]">
                /100
              </small>
            </strong>
            <Badge
              variant={statusVariant}
              className="h-auto gap-[6px] px-[10px] py-[6px] text-[12px] font-medium max-[700px]:mt-1 max-[700px]:flex max-[700px]:w-fit max-[700px]:p-[3px_5px] max-[700px]:text-[9px]"
            >
              <span className="h-[5px] w-[5px] rounded-full bg-current" />
              {fragilityScore >= 70
                ? "Crítico"
                : fragilityScore >= 40
                  ? "Precaución"
                  : "Estable"}
            </Badge>
          </div>
          <div className="relative my-[3px] mb-[9px] h-[5px] bg-surface-muted max-[700px]:mt-[9px] max-[700px]:h-[4px]">
            <div
              style={{ width: `${fragilityScore}%` }}
              className="h-full bg-brand-blue transition-[width] duration-100"
            />
            <i
              style={{ left: `${fragilityScore}%` }}
              className="absolute top-[-3px] h-[11px] w-[2px] -translate-x-1/2 border border-canvas bg-ink transition-[left] duration-100"
            />
          </div>
          <div className="flex justify-between text-[11px] text-body-muted max-[700px]:hidden">
            <span>Más resistente</span>
            <span>Más vulnerable</span>
          </div>
        </div>
        <div className="min-w-0 rounded-lg border border-hairline bg-surface-subtle p-3 max-[700px]:p-[10px]">
          <span className="flex items-center gap-[6px] text-[11px] text-body-muted">
            <Clock3 size={16} /> Tiempo de cobertura
          </span>
          <strong className="font-title my-[11px] mb-[7px] block text-[26px] font-semibold tracking-normal tabular-nums max-[700px]:my-[6px] max-[700px]:text-[23px]">
            {survivalWeeks}{" "}
            <small className="text-[11px] font-normal text-body-subtle">
              semanas
            </small>
          </strong>
          <span className="text-[12px] text-body-muted max-[700px]:hidden">
            Antes de agotar liquidez
          </span>
        </div>
        <div className="min-w-0 rounded-lg border border-hairline bg-surface-subtle p-3 max-[700px]:p-[10px]">
          <span className="flex items-center gap-[6px] text-[11px] text-body-muted">
            <ShieldCheck size={16} /> Reserva sugerida
          </span>
          <strong className="font-title my-[11px] mb-[7px] block text-[25px] font-semibold tracking-normal tabular-nums max-[700px]:my-[6px] max-[700px]:text-[17px]">
            {formatMoney(recommendedBuffer)}
          </strong>
          <span className="text-[12px] text-body-muted max-[700px]:hidden">
            Para absorber imprevistos · MXN
          </span>
        </div>
      </div>
      <div className="mt-[12px] flex items-start gap-[10px] border-l-4 border-info bg-info-soft p-[12px_13px]">
        <ShieldCheck size={18} className="mt-[2px] shrink-0 text-info" />
        <p className="text-[11px] leading-[1.7] text-ink max-[700px]:text-[10px]">
          {contextMessage}
        </p>
      </div>
      <div className="flex items-center justify-between border-b border-hairline p-[18px_0_15px] max-[700px]:p-[10px_0] min-[701px]:p-[14px_0]">
        <span className="flex items-center gap-[9px] text-[12px] text-body-subtle max-[700px]:text-[10px]">
          <span className="flex bg-warning-soft p-[9px] text-warning">
            <Clock3 size={16} />
          </span>
          <span>
            Próximo pago crítico
            <strong className="mt-1 block text-[12px] font-medium text-body">
              Nómina en 6 días
            </strong>
          </span>
        </span>
        <span className="text-[12px] font-medium text-body max-[700px]:text-[11px]">
          $72,000
        </span>
      </div>
      <div className="flex justify-between pt-4 text-[12px] text-body-muted max-[700px]:pt-[10px] max-[700px]:text-[10px]">
        <span>Concentración del principal cliente</span>
        <strong className="text-[12px] text-body">42%</strong>
      </div>
    </Card>
  );
}
