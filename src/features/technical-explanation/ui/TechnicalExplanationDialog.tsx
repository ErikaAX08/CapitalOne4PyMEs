import { Check, CircleHelp } from "lucide-react";
import { Modal } from "../../../shared";
export function TechnicalExplanationDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <Modal title="Detrás de tu estabilidad" onClose={onClose}>
      <p className="mt-3 text-[13px] leading-[1.8] text-[#7e8fa5]">
        Dos perspectivas complementarias para entender tu liquidez.
      </p>
      <div className="mt-[25px]">
        <span className="mr-[9px] inline-block rounded-[5px] bg-[#edf3fc] p-[6px] text-[12px] text-[#6e8fbf]">
          01
        </span>
        <h3 className="inline text-[16px] font-semibold">Señal estructural</h3>
        <p className="mt-3 text-[12px] leading-[1.8] text-[#7a8ea8]">
          Analizamos cómo cambia la relación entre ingresos, saldo, tiempos de
          cobro, gastos fijos y concentración de clientes.
        </p>
        <div className="mt-[14px] rounded-lg border border-[#e6edf5] bg-[#f5f8fc] p-3">
          <span className="text-[11px] text-[#8c9aaf]">
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
      <div className="mt-[25px]">
        <span className="mr-[9px] inline-block rounded-[5px] bg-[#edf3fc] p-[6px] text-[12px] text-[#6e8fbf]">
          02
        </span>
        <h3 className="inline text-[16px] font-semibold">
          Simulación de caja
        </h3>
        <p className="mt-3 text-[12px] leading-[1.8] text-[#7a8ea8]">
          Proyectamos cobros, pagos y escenarios para estimar el momento en
          que el negocio perdería liquidez.
        </p>
      </div>
      <div className="mt-[14px] flex items-start gap-[10px] rounded-lg bg-[#f0f6fc] p-[12px_13px] text-[#5980ab]">
        <CircleHelp size={20} className="mt-[2px] shrink-0" />
        <p className="text-[11px] leading-[1.7] text-[#5b7492] max-[700px]:text-[10px]">
          La señal topológica detecta cambios estructurales; la simulación
          financiera los traduce en pesos y semanas.
        </p>
      </div>
      <p className="my-4 text-[12px] leading-[1.7] text-[#65778e] max-[700px]:text-[11px]">
        Esta demo usa resultados deterministas simulados. No ejecuta
        homología persistente, no predice quiebras y no demuestra poder
        predictivo de la topología. Nessie y los motores analíticos son
        integraciones futuras.
      </p>
      <button
        className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-[#296bd5] bg-[#296bd5] px-[18px] py-[14px] text-[13px] font-medium text-white shadow-[0_4px_9px_#296bd51a] hover:bg-[#205cbd] disabled:cursor-wait disabled:opacity-45 max-[700px]:min-h-[46px]"
        onClick={onClose}
      >
        Entendido <Check size={17} />
      </button>
    </Modal>
  );
}
