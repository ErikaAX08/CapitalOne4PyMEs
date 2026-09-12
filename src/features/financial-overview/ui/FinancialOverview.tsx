import { Building2, CircleHelp, Clock3, ShieldCheck } from "lucide-react";
import { formatMoney } from "../../../shared";
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
  const statusClass =
    fragilityScore >= 70
      ? "bg-[#fceae7] text-[#b95243]"
      : fragilityScore >= 40
        ? "bg-[#fff3d8] text-[#916713]"
        : "bg-[#eaf6f0] text-[#318663]";
  return (
    <section className="self-start rounded-[14px] border border-[#e2e8f0] bg-white p-[24px_26px] shadow-[0_3px_6px_#20365903] max-[700px]:p-[15px] min-[701px]:p-[20px_24px]">
      <div className="flex items-center justify-between border-b border-[#eef1f6] pb-[22px] text-[13px] font-semibold max-[700px]:pb-[11px] max-[700px]:text-[12px] min-[701px]:pb-[15px]">
        <span className="flex items-center gap-[9px]">
          <Building2 size={18} /> Distribuidora Luna
        </span>
        <span className="text-[11px] font-normal text-[#65778e]">
          12 empleados
        </span>
      </div>
      <div className="p-[22px_0_23px] max-[700px]:p-[12px_0] min-[701px]:p-[17px_0]">
        <span className="text-[12px] text-[#65778e]">Saldo disponible</span>
        <div className="my-[5px] mb-[9px] text-[35px] font-semibold tracking-[-1.2px] max-[700px]:my-[4px] max-[700px]:text-[27px]">
          {formatMoney(availableBalance)}{" "}
          <small className="text-[12px] font-medium tracking-normal text-[#8793a3]">
            MXN
          </small>
        </div>
        <span className="flex items-center gap-[5px] text-[12px] text-[#65778e] max-[700px]:hidden">
          <span className="h-[5px] w-[5px] rounded-full bg-[#4da98b]" />
          {hasExpenses
            ? "Saldo después de los gastos simulados"
            : "Operación actual · antes de la decisión"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-[12px] max-[700px]:grid-cols-[1.1fr_1fr_1fr] max-[700px]:gap-[7px]">
        <div className="col-span-2 min-w-0 rounded-[10px] border border-[#e7ecf2] bg-[#fafcfe] p-3 max-[700px]:col-span-1 max-[700px]:p-[10px]">
          <div className="flex items-center justify-between gap-[6px] text-[11px] text-[#64778e] max-[700px]:min-h-[28px] max-[700px]:gap-1 max-[700px]:text-[10px] max-[700px]:leading-[1.4]">
            Índice de Fragilidad{" "}
            <CircleHelp size={14} className="max-[700px]:hidden" />
          </div>
          <div className="my-[5px] mb-3 flex items-center justify-between max-[700px]:my-[2px] max-[700px]:mb-[9px] max-[700px]:block">
            <strong className="text-[37px] font-semibold tracking-[-1px] max-[700px]:text-[27px]">
              {fragilityScore}
              <small className="ml-[3px] text-[16px] font-normal text-[#8c99aa] max-[700px]:inline max-[700px]:text-[11px]">
                /100
              </small>
            </strong>
            <span
              className={`inline-flex items-center gap-[6px] rounded-[20px] px-[10px] py-[6px] text-[12px] font-medium whitespace-nowrap ${statusClass} max-[700px]:mt-1 max-[700px]:flex max-[700px]:w-fit max-[700px]:p-[3px_5px] max-[700px]:text-[9px]`}
            >
              <span className="h-[5px] w-[5px] rounded-full bg-current" />
              {fragilityScore >= 70
                ? "Crítico"
                : fragilityScore >= 40
                  ? "Precaución"
                  : "Estable"}
            </span>
          </div>
          <div className="relative my-[3px] mb-[9px] h-[5px] rounded-lg bg-[linear-gradient(90deg,#62bfa0_0%,#9ccb83_33%,#ebcf6c_62%,#e88578_100%)] max-[700px]:mt-[9px] max-[700px]:h-[4px]">
            <i
              style={{ left: `${fragilityScore}%` }}
              className="absolute top-[-3px] h-[11px] w-[5px] -translate-x-1/2 rounded-[3px] border-[1.5px] border-white bg-[#263b57] transition-[left] duration-100"
            />
          </div>
          <div className="flex justify-between text-[11px] text-[#65778e] max-[700px]:hidden">
            <span>Menor fragilidad</span>
            <span>Mayor fragilidad</span>
          </div>
        </div>
        <div className="min-w-0 rounded-[10px] border border-[#e7ecf2] p-3 max-[700px]:p-[10px]">
          <span className="flex items-center gap-[6px] text-[11px] text-[#64778e]">
            <Clock3 size={16} /> Supervivencia
          </span>
          <strong className="my-[11px] mb-[7px] block text-[26px] font-semibold tracking-[-1px] max-[700px]:my-[6px] max-[700px]:text-[23px]">
            {survivalWeeks}{" "}
            <small className="text-[11px] font-normal text-[#8391a2]">
              semanas
            </small>
          </strong>
          <span className="text-[12px] text-[#65778e] max-[700px]:hidden">
            Horizonte de operación
          </span>
        </div>
        <div className="min-w-0 rounded-[10px] border border-[#e7ecf2] p-3 max-[700px]:p-[10px]">
          <span className="flex items-center gap-[6px] text-[11px] text-[#64778e]">
            <ShieldCheck size={16} /> Buffer recomendado
          </span>
          <strong className="my-[11px] mb-[7px] block text-[25px] font-semibold tracking-[-1px] max-[700px]:my-[6px] max-[700px]:text-[17px] max-[700px]:tracking-[-0.7px]">
            {formatMoney(recommendedBuffer)}
          </strong>
          <span className="text-[12px] text-[#65778e] max-[700px]:hidden">
            Capital de trabajo · MXN
          </span>
        </div>
      </div>
      <div className="mt-[12px] flex items-start gap-[10px] rounded-lg bg-[#f0f6fc] p-[12px_13px] text-[#5980ab]">
        <ShieldCheck size={18} className="mt-[2px] shrink-0" />
        <p className="text-[11px] leading-[1.7] text-[#5b7492] max-[700px]:text-[10px]">
          {contextMessage}
        </p>
      </div>
      <div className="flex items-center justify-between border-b border-[#eef1f6] p-[18px_0_15px] max-[700px]:p-[10px_0] min-[701px]:p-[14px_0]">
        <span className="flex items-center gap-[9px] text-[12px] text-[#8793a3] max-[700px]:text-[10px]">
          <span className="flex rounded-[9px] bg-[#fff3ec] p-[9px] text-[#d99363]">
            <Clock3 size={16} />
          </span>
          <span>
            Próximo pago crítico
            <strong className="mt-1 block text-[12px] font-medium text-[#455a73]">
              Nómina en 6 días
            </strong>
          </span>
        </span>
        <span className="text-[12px] font-medium text-[#526780] max-[700px]:text-[11px]">
          $72,000
        </span>
      </div>
      <div className="flex justify-between pt-4 text-[12px] text-[#65778e] max-[700px]:pt-[10px] max-[700px]:text-[10px]">
        <span>Concentración del principal cliente</span>
        <strong className="text-[12px] text-[#59708d]">42%</strong>
      </div>
    </section>
  );
}
