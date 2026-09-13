import { Check, CircleHelp } from "lucide-react";
import { Modal, Button, Alert, AlertDescription } from "@shared";
export function TechnicalExplanationDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <Modal title="Detrás de tu estabilidad" onClose={onClose}>
      <p className="mt-3 text-[13px] leading-[1.8] text-body-muted">
        Dos perspectivas complementarias para entender tu liquidez.
      </p>
      <div className="mt-[25px]">
        <span className="mr-[9px] inline-block rounded-md bg-surface-muted p-[6px] font-mono text-[12px] text-ink">
          01
        </span>
        <h3 className="inline text-[16px] font-semibold">Señal estructural</h3>
        <p className="mt-3 text-[12px] leading-[1.8] text-body-muted">
          Analizamos cómo cambia la relación entre ingresos, saldo, tiempos de
          cobro, gastos fijos y concentración de clientes.
        </p>
        <div className="mt-[14px] rounded-xl border border-hairline bg-surface-muted/60 p-3">
          <span className="text-[11px] text-body-subtle">
            Diagrama de persistencia · ilustrativo
          </span>
          <svg
            viewBox="0 0 300 100"
            role="img"
            aria-label="Diagrama ilustrativo de persistencia, sin cálculo topológico real"
            className="h-[105px] w-full"
          >
            <path
              d="M20 10V80H285 M20 80L275 15"
              stroke="var(--color-hairline-strong)"
              strokeDasharray="4 4"
              fill="none"
            />
            {[
              [50, 50],
              [90, 56],
              [110, 28],
              [150, 40],
              [198, 18],
              [220, 30],
            ].map(([cx, cy], i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="5"
                fill={
                  i === 4
                    ? "var(--color-chart-anomaly)"
                    : "var(--color-chart-1)"
                }
              />
            ))}
          </svg>
        </div>
      </div>
      <div className="mt-[25px]">
        <span className="mr-[9px] inline-block rounded-md bg-surface-muted p-[6px] font-mono text-[12px] text-ink">
          02
        </span>
        <h3 className="inline text-[16px] font-semibold">Simulación de caja</h3>
        <p className="mt-3 text-[12px] leading-[1.8] text-body-muted">
          Proyectamos cobros, pagos y escenarios para estimar el momento en que
          el negocio perdería liquidez.
        </p>
      </div>
      <Alert variant="info" className="mt-[14px]">
        <CircleHelp size={20} className="mt-[2px] shrink-0 text-info" />
        <AlertDescription className="text-[11px] leading-[1.7] max-[700px]:text-[10px]">
          La señal topológica detecta cambios estructurales; la simulación
          financiera los traduce en pesos y semanas.
        </AlertDescription>
      </Alert>
      <p className="my-4 text-[12px] leading-[1.7] text-body-muted max-[700px]:text-[11px]">
        Esta demo usa resultados deterministas simulados. No ejecuta homología
        persistente, no predice quiebras y no demuestra poder predictivo de la
        topología. Nessie y los motores analíticos son integraciones futuras.
      </p>
      <Button
        variant="primary"
        className="w-full gap-3 max-[700px]:min-h-[46px]"
        onClick={onClose}
      >
        Entendido <Check size={17} />
      </Button>
    </Modal>
  );
}
