import { ArrowRight, Building2, Clock3, TriangleAlert } from "lucide-react";
import type { Scenario } from "@entities/scenario";
import {
  Modal,
  Button,
  Alert,
  AlertDescription,
  Input,
  Label,
} from "@shared";
export function ScenarioDialog({
  scenario,
  simulationWeeks,
  onSimulationWeeksChange,
  onClose,
  onSimulate,
}: {
  scenario: Scenario;
  simulationWeeks: number;
  onSimulationWeeksChange: (weeks: number) => void;
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
        <>
          <Alert variant="warning" className="mb-4">
            <TriangleAlert size={20} className="shrink-0 text-warning" />
            <AlertDescription className="text-[12px] leading-[1.7]">
              Caso sintético: el cobro llega 20 días tarde. En 20,000 futuros,
              46.9% presenta una brecha y el punto de ruptura aparece el día 75.
            </AlertDescription>
          </Alert>
          <div className="mb-5 border border-hairline bg-surface-subtle p-4">
            <div className="flex items-end justify-between gap-4">
              <Label
                htmlFor="simulation-weeks"
                className="block text-[12px] leading-[1.5] text-body"
              >
                Duración del timelapse
                <small className="mt-1 block font-normal text-body-muted">
                  Elige cuántas semanas recorrerá la simulación.
                </small>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="simulation-weeks"
                  type="number"
                  min={12}
                  max={24}
                  value={simulationWeeks}
                  onChange={(event) =>
                    onSimulationWeeksChange(
                      Math.min(24, Math.max(12, Number(event.target.value))),
                    )
                  }
                  className="w-[76px] text-center font-semibold"
                />
                <span className="text-[11px] text-body-muted">semanas</span>
              </div>
            </div>
          </div>
        </>
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
        Iniciar timelapse <ArrowRight size={18} />
      </Button>
      <span className="mt-[14px] flex items-center justify-center gap-[5px] text-[12px] text-body-subtle">
        <Clock3 size={14} /> {simulationWeeks} semanas resumidas en 8 segundos
      </span>
    </Modal>
  );
}
