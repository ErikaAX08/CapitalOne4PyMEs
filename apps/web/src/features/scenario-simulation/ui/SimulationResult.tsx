import { motion } from "framer-motion";
import {
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  formatMoney,
  Card,
  Badge,
  Button,
  Alert,
  AlertDescription,
} from "@shared";
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
      aria-live="polite"
    >
      <Card
        className={`gap-0 p-[23px] max-[700px]:p-[18px] ${
          isRecoveredLook ? "border-success" : "border-danger"
        }`}
      >
        <div
          className={`flex items-center gap-[9px] max-[700px]:flex-wrap max-[700px]:gap-[8px] ${recovered ? "text-success" : "text-danger"}`}
        >
          {recovered ? <ShieldCheck size={22} /> : <TriangleAlert size={22} />}
          <h3 className="font-title max-w-[85%] text-[17px] font-semibold text-ink">
            {recovered
              ? minimumProjectedBalance < 0
                ? "El anticipo aún no cubre tus gastos"
                : "Una decisión más resiliente"
              : isContract
                ? "Rentable no siempre significa sostenible"
                : "Así cambia tu estabilidad"}
          </h3>
          <Badge
            variant={status === "Crítico" ? "danger" : "warning"}
            className="h-auto px-[10px] py-[6px] text-[12px] font-medium"
          >
            {status}
          </Badge>
        </div>
        <p className="mt-[13px] text-[13px] leading-[1.8] text-body-muted">
          {recovered
            ? recommendation
            : isContract
              ? "El contrato es rentable, pero tu negocio podría quedarse sin efectivo antes de cobrarlo."
              : recommendation}
        </p>
        <div className="my-1 grid grid-cols-2 gap-5 p-[18px_0] text-[12px] text-body-subtle">
          <span>
            Fragilidad
            <strong className="mt-[7px] block text-[16px] font-semibold text-body max-[700px]:text-[14px]">
              {fragilityBefore} → {fragilityAfter}
            </strong>
          </span>
          <span>
            Supervivencia
            <strong className="mt-[7px] block text-[16px] font-semibold text-body max-[700px]:text-[14px]">
              {survivalBefore} → {survivalAfter} semanas
            </strong>
          </span>
          <span>
            {recovered ? "Buffer restante" : "Saldo mínimo proyectado"}
            <strong className="mt-[7px] block text-[16px] font-semibold text-body max-[700px]:text-[14px]">
              {formatMoney(
                recovered ? recommendedBuffer : minimumProjectedBalance,
              )}{" "}
              MXN
            </strong>
          </span>
          {criticalWeek && (
            <span>
              Semana crítica
              <strong className="mt-[7px] block text-[16px] font-semibold text-body max-[700px]:text-[14px]">
                Semana {criticalWeek}
              </strong>
            </span>
          )}
        </div>
        {!recovered && (
          <Alert variant="info">
            <Sparkles size={19} className="shrink-0 text-info" />
            <div>
              <strong className="text-[12px] font-semibold">
                Tu siguiente mejor paso
              </strong>
              <p className="mt-[5px] text-[12px] leading-[1.8] text-body-muted">
                {recommendation}
              </p>
            </div>
          </Alert>
        )}
        <div className="mt-[18px] flex flex-col gap-3">
          {canMitigate && (
            <Button
              variant="primary"
              className="gap-3 max-[700px]:min-h-[46px]"
              onClick={onMitigate}
            >
              Aplicar anticipo del 40% <ArrowRight size={17} />
            </Button>
          )}
          <Button
            variant="secondary"
            className="gap-2 max-[700px]:min-h-[46px]"
            onClick={onReset}
          >
            <RotateCcw size={16} /> Reiniciar simulación
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
