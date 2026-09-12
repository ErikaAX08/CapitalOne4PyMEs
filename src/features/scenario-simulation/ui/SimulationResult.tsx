import { motion } from "framer-motion";
import {
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { formatMoney } from "@shared";
export function SimulationResult({
  recovered,
  isContract,
  status,
  minimumProjectedBalance,
  recommendedBuffer,
  recommendation,
  fragilityBefore,
  fragilityAfter,
  survivalBefore,
  survivalAfter,
  criticalWeek,
  canMitigate,
  onMitigate,
  onReset,
}: {
  recovered: boolean;
  isContract: boolean;
  status: string;
  minimumProjectedBalance: number;
  recommendedBuffer: number;
  recommendation: string;
  fragilityBefore: number;
  fragilityAfter: number;
  survivalBefore: number;
  survivalAfter: number;
  criticalWeek: number | null;
  canMitigate: boolean;
  onMitigate: () => void;
  onReset: () => void;
}) {
  const isRecoveredLook = recovered && minimumProjectedBalance >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-[23px] max-[700px]:p-[18px] ${
        isRecoveredLook
          ? "border-[#bddccc] bg-[#fbfefc]"
          : "border-[#efcec6] bg-[#fffcfb]"
      }`}
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-[9px] max-[700px]:flex-wrap max-[700px]:gap-[8px] ${recovered ? "text-[#458c70]" : "text-[#c7705e]"}`}
      >
        {recovered ? <ShieldCheck size={22} /> : <TriangleAlert size={22} />}
        <h3 className="text-[17px] font-semibold text-[#314862] max-[700px]:max-w-[85%] max-[700px]:text-[16px] max-[700px]:leading-[1.5]">
          {recovered
            ? minimumProjectedBalance < 0
              ? "El anticipo aún no cubre tus gastos"
              : "Una decisión más resiliente"
            : isContract
              ? "Rentable no siempre significa sostenible"
              : "Así cambia tu estabilidad"}
        </h3>
        <span
          className={`inline-flex items-center gap-[6px] rounded-[20px] px-[10px] py-[6px] text-[12px] font-medium whitespace-nowrap ${status === "Crítico" ? "bg-[#fceae7] text-[#b95243]" : "bg-[#fff3d8] text-[#916713]"}`}
        >
          {status}
        </span>
      </div>
      <p className="mt-[13px] text-[13px] leading-[1.8] text-[#7b8596]">
        {recovered
          ? recommendation
          : isContract
            ? "El contrato es rentable, pero tu negocio podría quedarse sin efectivo antes de cobrarlo."
            : recommendation}
      </p>
      <div className="my-1 grid grid-cols-2 gap-5 p-[18px_0] text-[12px] text-[#8b97a8]">
        <span>
          Fragilidad
          <strong className="mt-[7px] block text-[16px] font-semibold text-[#536b89] max-[700px]:text-[14px]">
            {fragilityBefore} → {fragilityAfter}
          </strong>
        </span>
        <span>
          Supervivencia
          <strong className="mt-[7px] block text-[16px] font-semibold text-[#536b89] max-[700px]:text-[14px]">
            {survivalBefore} → {survivalAfter} semanas
          </strong>
        </span>
        <span>
          {recovered ? "Buffer restante" : "Saldo mínimo proyectado"}
          <strong className="mt-[7px] block text-[16px] font-semibold text-[#536b89] max-[700px]:text-[14px]">
            {formatMoney(
              recovered ? recommendedBuffer : minimumProjectedBalance,
            )}{" "}
            MXN
          </strong>
        </span>
        {criticalWeek && (
          <span>
            Semana crítica
            <strong className="mt-[7px] block text-[16px] font-semibold text-[#536b89] max-[700px]:text-[14px]">
              Semana {criticalWeek}
            </strong>
          </span>
        )}
      </div>
      {!recovered && (
        <div className="flex gap-[11px] rounded-lg bg-[#f3f6fc] p-[15px] text-[#5180bf]">
          <Sparkles size={19} className="shrink-0" />
          <div>
            <strong className="text-[12px] font-semibold">
              Tu siguiente mejor paso
            </strong>
            <p className="mt-[5px] text-[12px] leading-[1.8] text-[#6e8199]">
              {recommendation}
            </p>
          </div>
        </div>
      )}
      <div className="mt-[18px] flex flex-col gap-3">
        {canMitigate && (
          <button
            className="inline-flex items-center justify-center gap-3 rounded-lg border border-[#296bd5] bg-[#296bd5] px-[18px] py-[14px] text-[13px] font-medium text-white shadow-[0_4px_9px_#296bd51a] hover:bg-[#205cbd] max-[700px]:min-h-[46px]"
            onClick={onMitigate}
          >
            Aplicar anticipo del 40% <ArrowRight size={17} />
          </button>
        )}
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#dce5ef] bg-white px-[17px] py-[13px] text-[12px] text-[#667b95] max-[700px]:min-h-[46px]"
          onClick={onReset}
        >
          <RotateCcw size={16} /> Reiniciar simulación
        </button>
      </div>
    </motion.div>
  );
}
