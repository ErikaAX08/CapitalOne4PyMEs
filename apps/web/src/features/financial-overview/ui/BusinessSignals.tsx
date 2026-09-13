import { Building2, Clock3, ShieldCheck } from "lucide-react";
import { Card } from "@shared";

/** The context around the statistics row: who the business is, what the base
 *  state means in words, and the two obligations that shape it. */
export function BusinessSignals({
  contextMessage,
}: {
  contextMessage: string;
}) {
  return (
    <Card className="gap-0 p-[22px] max-[700px]:p-[18px]">
      <div className="flex items-center justify-between border-b border-hairline pb-[15px] text-[13px] font-semibold max-[700px]:pb-[11px] max-[700px]:text-[12px]">
        <span className="flex items-center gap-[9px]">
          <Building2 size={18} /> Distribuidora Luna
        </span>
        <span className="text-[11px] font-normal text-body-muted">
          12 empleados
        </span>
      </div>
      <div className="mt-[15px] flex items-start gap-[10px] border-l-4 border-info bg-info-soft p-[12px_13px]">
        <ShieldCheck size={18} className="mt-[2px] shrink-0 text-info" />
        <p className="text-[11px] leading-[1.7] text-ink max-[700px]:text-[10px]">
          {contextMessage}
        </p>
      </div>
      <div className="flex items-center justify-between border-b border-hairline p-[18px_0_15px] max-[700px]:p-[14px_0_12px]">
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
