import { ArrowRight, Building2, Clock3, TriangleAlert } from "lucide-react";
import type { Scenario } from "../../../entities/scenario";
import { Modal } from "../../../shared";
export function ScenarioDialog({
  scenario,
  onClose,
  onSimulate,
}: {
  scenario: Scenario;
  onClose: () => void;
  onSimulate: () => void;
}) {
  return (
    <Modal title={scenario.title} onClose={onClose}>
      <p className="mt-3 text-[13px] leading-[1.8] text-[#7e8fa5]">
        {scenario.description}
      </p>
      <div className="mt-4 flex items-center gap-[9px] border-b border-[#e8edf4] p-[17px_0] text-[12px]">
        <Building2 size={19} /> Distribuidora Luna{" "}
        <span className="ml-auto text-[12px] text-[#8b9aad]">MXN</span>
      </div>
      <dl className="my-[10px] mb-5">
        {scenario.details.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-[10px] p-[12px_0] text-[12px]"
          >
            <dt className="text-[#7c8ca0]">{label}</dt>
            <dd className="m-0 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {scenario.id === "contract" && (
        <div className="flex gap-[10px] rounded-[9px] bg-[#fff7e8] p-[14px] text-[#b18a3b]">
          <TriangleAlert size={20} className="shrink-0" />
          <p className="text-[12px] leading-[1.7] text-[#917a51]">
            El inventario y la nómina se pagan antes de cobrar. La simulación
            también probará un retraso de 30 días de tu cliente principal.
          </p>
        </div>
      )}
      <p className="my-4 text-[12px] leading-[1.7] text-[#65778e] max-[700px]:text-[11px]">
        Cifras ilustrativas. El margen considera otros costos del contrato; la
        inversión inicial no equivale al costo total.
      </p>
      <button
        className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-[#296bd5] bg-[#296bd5] px-[18px] py-[14px] text-[13px] font-medium text-white shadow-[0_4px_9px_#296bd51a] hover:bg-[#205cbd] max-[700px]:min-h-[46px]"
        onClick={onSimulate}
      >
        Simular decisión <ArrowRight size={18} />
      </button>
      <span className="mt-[14px] flex items-center justify-center gap-[5px] text-[12px] text-[#91a0b3]">
        <Clock3 size={14} /> 8 segundos para ver una nueva perspectiva
      </span>
    </Modal>
  );
}
