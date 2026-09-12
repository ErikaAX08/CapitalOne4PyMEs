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
      <p>{scenario.description}</p>
      <div className="sheet-business">
        <Building2 size={19} /> Distribuidora Luna <span>MXN</span>
      </div>
      <dl>
        {scenario.details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {scenario.id === "contract" && (
        <div className="sheet-note">
          <TriangleAlert size={20} />
          <p>
            El inventario y la nómina se pagan antes de cobrar. La simulación
            también probará un retraso de 30 días de tu cliente principal.
          </p>
        </div>
      )}
      <p className="fine-print">
        Cifras ilustrativas. El margen considera otros costos del contrato; la
        inversión inicial no equivale al costo total.
      </p>
      <button className="primary full" onClick={onSimulate}>
        Simular decisión <ArrowRight size={18} />
      </button>
      <span className="sheet-time">
        <Clock3 size={14} /> 8 segundos para ver una nueva perspectiva
      </span>
    </Modal>
  );
}
