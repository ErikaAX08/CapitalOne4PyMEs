import { motion } from "framer-motion";
import {
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { formatMoney } from "../../../shared";
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`result ${recovered && minimumProjectedBalance >= 0 ? "recovered" : ""}`}
      aria-live="polite"
    >
      <div className="result-title">
        {recovered ? <ShieldCheck size={22} /> : <TriangleAlert size={22} />}
        <h3>
          {recovered
            ? minimumProjectedBalance < 0
              ? "El anticipo aún no cubre tus gastos"
              : "Una decisión más resiliente"
            : isContract
              ? "Rentable no siempre significa sostenible"
              : "Así cambia tu estabilidad"}
        </h3>
        <span
          className={`status ${status === "Crítico" ? "danger" : "warning"}`}
        >
          {status}
        </span>
      </div>
      <p>
        {recovered
          ? recommendation
          : isContract
            ? "El contrato es rentable, pero tu negocio podría quedarse sin efectivo antes de cobrarlo."
            : recommendation}
      </p>
      <div className="result-metrics">
        <span>
          Fragilidad
          <strong>
            {fragilityBefore} → {fragilityAfter}
          </strong>
        </span>
        <span>
          Supervivencia
          <strong>
            {survivalBefore} → {survivalAfter} semanas
          </strong>
        </span>
        <span>
          {recovered ? "Buffer restante" : "Saldo mínimo proyectado"}
          <strong>
            {formatMoney(recovered ? recommendedBuffer : minimumProjectedBalance)}{" "}
            MXN
          </strong>
        </span>
        {criticalWeek && (
          <span>
            Semana crítica
            <strong>Semana {criticalWeek}</strong>
          </span>
        )}
      </div>
      {!recovered && (
        <div className="recommendation">
          <Sparkles size={19} />
          <div>
            <strong>Tu siguiente mejor paso</strong>
            <p>{recommendation}</p>
          </div>
        </div>
      )}
      <div className="result-actions">
        {canMitigate && (
          <button className="primary" onClick={onMitigate}>
            Aplicar anticipo del 40% <ArrowRight size={17} />
          </button>
        )}
        <button className="secondary" onClick={onReset}>
          <RotateCcw size={16} /> Reiniciar simulación
        </button>
      </div>
    </motion.div>
  );
}
