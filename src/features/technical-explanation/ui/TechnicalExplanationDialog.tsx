import { Check, CircleHelp } from "lucide-react";
import { Modal } from "../../../shared";
export function TechnicalExplanationDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <Modal title="Detrás de tu estabilidad" onClose={onClose}>
      <p>Dos perspectivas complementarias para entender tu liquidez.</p>
      <div className="technical-section">
        <span className="number">01</span>
        <h3>Señal estructural</h3>
        <p>
          Analizamos cómo cambia la relación entre ingresos, saldo, tiempos de
          cobro, gastos fijos y concentración de clientes.
        </p>
        <div className="persistence">
          <span>Diagrama de persistencia · ilustrativo</span>
          <svg
            viewBox="0 0 300 100"
            role="img"
            aria-label="Diagrama ilustrativo de persistencia, sin cálculo topológico real"
          >
            <path
              d="M20 10V80H285 M20 80L275 15"
              stroke="#c7d3e2"
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
                fill={i === 4 ? "#e88478" : "#4285dc"}
              />
            ))}
          </svg>
        </div>
      </div>
      <div className="technical-section">
        <span className="number">02</span>
        <h3>Simulación de caja</h3>
        <p>
          Proyectamos cobros, pagos y escenarios para estimar el momento en
          que el negocio perdería liquidez.
        </p>
      </div>
      <div className="context">
        <CircleHelp size={20} />
        <p>
          La señal topológica detecta cambios estructurales; la simulación
          financiera los traduce en pesos y semanas.
        </p>
      </div>
      <p className="fine-print">
        Esta demo usa resultados deterministas simulados. No ejecuta
        homología persistente, no predice quiebras y no demuestra poder
        predictivo de la topología. Nessie y los motores analíticos son
        integraciones futuras.
      </p>
      <button className="primary full" onClick={onClose}>
        Entendido <Check size={17} />
      </button>
    </Modal>
  );
}
