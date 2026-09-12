import { ArrowRight, Building2, Clock3, TriangleAlert } from "lucide-react";
import type { Scenario } from "@entities/scenario";
import { Modal, Button, Alert, AlertDescription } from "@shared";
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
      <p className="mt-3 text-[13px] leading-[1.8] text-body-muted">
        {scenario.description}
      </p>
      <div className="mt-4 flex items-center gap-[9px] border-b border-hairline p-[17px_0] text-[12px]">
        <Building2 size={19} /> Distribuidora Luna{" "}
        <span className="ml-auto text-[12px] text-body-subtle">MXN</span>
      </div>
      <dl className="my-[10px] mb-5">
        {scenario.details.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-[10px] p-[12px_0] text-[12px]"
          >
            <dt className="text-body-muted">{label}</dt>
            <dd className="m-0 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {scenario.id === "contract" && (
        <Alert variant="warning" className="mb-4">
          <TriangleAlert size={20} className="shrink-0 text-warning" />
          <AlertDescription className="text-[12px] leading-[1.7]">
            El inventario y la nómina se pagan antes de cobrar. La simulación
            también probará un retraso de 30 días de tu cliente principal.
          </AlertDescription>
        </Alert>
      )}
      <p className="my-4 text-[12px] leading-[1.7] text-body-muted max-[700px]:text-[11px]">
        Cifras ilustrativas. El margen considera otros costos del contrato; la
        inversión inicial no equivale al costo total.
      </p>
      <Button
        variant="primary"
        className="w-full gap-3 max-[700px]:min-h-[46px]"
        onClick={onSimulate}
      >
        Simular decisión <ArrowRight size={18} />
      </Button>
      <span className="mt-[14px] flex items-center justify-center gap-[5px] text-[12px] text-body-subtle">
        <Clock3 size={14} /> 8 segundos para ver una nueva perspectiva
      </span>
    </Modal>
  );
}
