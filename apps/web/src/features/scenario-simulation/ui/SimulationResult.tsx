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
  simulationWeeks,
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
  simulationWeeks: number;
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
            variant={
              recovered
                ? "success"
                : status === "Crítico"
                  ? "danger"
                  : "warning"
            }
            className="h-auto px-[10px] py-[6px] text-[12px] font-medium"
          >
            {status}
          </Badge>
        </div>
        {isContract && (
          <div className="mb-4 border border-hairline bg-surface-subtle p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] text-body-muted">
                  20,000 futuros sintéticos
                </span>
                <strong className="mt-1 block text-[20px] font-semibold tracking-[-0.04em] text-ink">
                  {recovered ? "4.58%" : "46.9%"}
                </strong>
                <small className="text-[10px] text-body-muted">
                  futuros con brecha de liquidez
                </small>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-body-muted">
                  Punto de ruptura
                </span>
                <strong
                  className={`mt-1 block text-[14px] ${recovered ? "text-success" : "text-warning"}`}
                >
                  {recovered ? "Evitado" : "Día 75 · Nómina"}
                </strong>
                <small className="text-[10px] text-body-muted">
                  Horizonte: {simulationWeeks} semanas
                </small>
              </div>
            </div>
            <svg
              viewBox="0 0 320 72"
              className="mt-4 h-[72px] w-full"
              role="img"
              aria-label={
                recovered
                  ? "La liquidez se mantiene por encima de cero con el anticipo."
                  : "La liquidez cruza bajo cero en el día 75."
              }
            >
              <line
                x1="0"
                y1="53"
                x2="320"
                y2="53"
                stroke="#c7cede"
                strokeDasharray="4 4"
              />
              <polyline
                points={
                  recovered
                    ? "0,18 45,22 90,29 135,34 180,38 225,31 270,35 320,24"
                    : "0,15 45,22 90,30 135,36 180,43 225,49 265,64 320,38"
                }
                fill="none"
                stroke={recovered ? "#17845a" : "#d96b36"}
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {!recovered && <circle cx="265" cy="64" r="5" fill="#d96b36" />}
            </svg>
            <div className="flex justify-between text-[9px] text-body-subtle">
              <span>Inicio</span>
              <span>Línea cero</span>
              <span>Día {simulationWeeks * 7}</span>
            </div>
          </div>
        )}
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
              Pedir anticipo de 25% <ArrowRight size={17} />
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
