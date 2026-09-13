import { useEffect, useState } from "react";
import { CircleHelp, Gauge, Hand, Icon, RotateCcw } from "lucide-react";
import type { SimulationFlowState } from "@features/scenario-simulation";
import type { SimulationOutput } from "@entities/simulation";
import { Card, Badge, Button, Modal } from "@shared";
import { BLOCK_ICON_NODES, type BlockIconLabel } from "../model/blockIcons";
import { ResilienceTower } from "./ResilienceTower";

const BLOCK_GUIDE: {
  title: string;
  description: string;
  items: { label: BlockIconLabel; meaning: string }[];
}[] = [
  {
    title: "Cimientos",
    description: "Sostienen todo lo que ocurre arriba.",
    items: [
      { label: "Efectivo", meaning: "Dinero disponible hoy" },
      {
        label: "Cuentas por cobrar",
        meaning: "Facturas que tus clientes aún no pagan",
      },
      {
        label: "Crédito disponible",
        meaning: "Financiamiento que todavía puedes utilizar",
      },
      {
        label: "Reservas",
        meaning: "Colchón para absorber imprevistos",
      },
    ],
  },
  {
    title: "Operación",
    description: "Convierte los recursos en trabajo diario.",
    items: [
      { label: "Nómina", meaning: "Pagos comprometidos con tu equipo" },
      {
        label: "Proveedores",
        meaning: "Obligaciones con quienes abastecen el negocio",
      },
      {
        label: "Inventario",
        meaning: "Recursos y materiales necesarios para operar",
      },
      {
        label: "Capacidad",
        meaning: "Trabajo que tu operación puede sostener",
      },
    ],
  },
  {
    title: "Crecimiento",
    description: "Depende de que los niveles inferiores sigan firmes.",
    items: [
      {
        label: "Contratos",
        meaning: "Compromisos comerciales vigentes",
      },
      {
        label: "Proyectos",
        meaning: "Trabajo que generará ingresos y costos",
      },
      {
        label: "Cliente principal",
        meaning: "Dependencia de tu mayor fuente de ingresos",
      },
      {
        label: "Cumplimiento fiscal",
        meaning: "Impuestos y obligaciones legales",
      },
    ],
  },
];

const ROTATION_SPEEDS = [
  { value: 0, label: "Pausada" },
  { value: 0.5, label: "Lenta" },
  { value: 1, label: "Media" },
  { value: 2, label: "Rápida" },
] as const;

export function TowerCard({
  flowState,
  status,
  expenseBlocks,
  instantResult,
  progress,
  output,
  resetKey,
  reduced,
  simulationWeeks,
  onReset,
}: {
  flowState: SimulationFlowState;
  status: SimulationOutput["status"];
  expenseBlocks: number;
  instantResult: boolean;
  progress: number;
  output: SimulationOutput;
  resetKey: number;
  reduced: boolean;
  simulationWeeks: number;
  onReset: () => void;
}) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState(reduced ? 0 : 0.5);
  useEffect(() => {
    if (reduced) setRotationSpeed(0);
  }, [reduced]);
  const currentDay = Math.max(1, Math.ceil(progress * simulationWeeks * 7));
  const statusVariant =
    status === "Crítico"
      ? "danger"
      : status === "Precaución"
        ? "warning"
        : "success";
  const hasCollectionDelay = output.towerBlockChanges.some(
    ({ action }) => action === "delayIncome",
  );
  const hasReinforcement = output.towerBlockChanges.some(
    ({ action }) => action === "addIncome" || action === "addLiquidity",
  );
  const towerGuidance =
    flowState === "simulating" && hasCollectionDelay
      ? "El cobro se retrasa: observa cómo la base expone la nómina"
      : flowState === "mitigating" || hasReinforcement
        ? "El refuerzo vuelve a sostener la operación y el crecimiento"
        : status === "Crítico"
          ? "La base perdió soporte: toca un bloque para entender por qué"
          : expenseBlocks > 0
            ? "Cada gasto retira soporte de los cimientos de tu empresa"
            : "Simula una decisión y observa cómo cambia tu empresa";
  return (
    <Card className="tower-card relative flex min-h-[604px] flex-col gap-0 overflow-hidden bg-surface-subtle py-0 max-[700px]:min-h-[480px] min-[701px]:sticky min-[701px]:top-[22px] min-[701px]:h-[min(830px,calc(100vh-44px))] min-[701px]:min-h-[620px]">
      <div className="z-1 flex justify-between p-[24px_25px_0] max-[700px]:p-[20px_20px_0]">
        <div>
          <span className="font-mono text-[11px] font-medium tracking-normal text-body-muted uppercase">
            Mapa visual de dependencias
          </span>
          <h2 className="font-title mt-1 text-xl font-semibold tracking-[-0.02em]">
            Esta torre representa tu empresa
          </h2>
          <p className="mt-1.5 max-w-[390px] text-[10px] leading-[1.5] text-body-muted">
            Los cimientos financieros sostienen la operación y el crecimiento.
            Si la base se debilita, los niveles superiores quedan en riesgo.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-[34px] w-[34px] max-[700px]:min-h-[42px] max-[700px]:min-w-[42px]"
          aria-label="Reiniciar simulación"
          title="Reiniciar simulación"
          onClick={onReset}
        >
          <RotateCcw size={18} />
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 p-[15px_25px_0] max-[700px]:p-[12px_20px_0]">
        <Badge
          variant={statusVariant}
          className="h-auto gap-[6px] px-[10px] py-[6px] text-[12px] font-medium"
        >
          <span className="h-[5px] w-[5px] rounded-full bg-current" />
          {flowState === "simulating"
            ? "Simulando decisión"
            : flowState === "mitigating"
              ? "Recuperando estabilidad"
              : status === "Estable"
                ? "Tu negocio tiene una base sólida"
                : status === "Crítico"
                  ? "La liquidez necesita refuerzo"
                  : "Una estructura con más perspectiva"}
        </Badge>
        {(flowState === "simulating" || flowState === "mitigating") && (
          <span className="text-[10px] font-medium text-body-muted">
            Día {currentDay} de {simulationWeeks * 7}
          </span>
        )}
        <label className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-2 text-[11px] text-body-muted focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/15">
          <Gauge size={14} aria-hidden="true" />
          <span>Giro</span>
          <select
            aria-label="Velocidad de giro de la torre"
            className="cursor-pointer border-0 bg-transparent pr-1 font-medium text-body outline-none"
            value={rotationSpeed}
            onChange={(event) => setRotationSpeed(Number(event.target.value))}
          >
            {ROTATION_SPEEDS.map((speed) => (
              <option key={speed.value} value={speed.value}>
                {speed.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="ghost"
          size="compact"
          className="h-8 px-2 text-[11px] text-body-muted"
          onClick={() => setGuideOpen(true)}
        >
          <CircleHelp size={14} /> Guía de iconos
        </Button>
      </div>
      <div className="relative min-h-[360px] flex-1 max-[700px]:h-[390px] max-[700px]:min-h-[390px] [&>.tower-3d]:absolute [&>.tower-3d]:inset-0">
        <ResilienceTower
          expenseBlocks={expenseBlocks}
          instantResult={instantResult}
          state={flowState}
          progress={progress}
          output={output}
          resetKey={resetKey}
          reduced={reduced}
          rotationSpeed={rotationSpeed}
        />
        <div className="pointer-events-none absolute top-[48px] right-[22px] max-w-[145px] text-[10px] text-body-subtle before:absolute before:top-[5px] before:left-[-30px] before:h-px before:w-[22px] before:bg-hairline-strong before:content-[''] min-[701px]:max-[1000px]:right-[12px] max-[1000px]:before:left-[-14px] max-[1000px]:before:w-[10px] max-[700px]:right-[9px] max-[700px]:max-w-[100px]">
          <strong className="font-medium text-body">
            Crecimiento · Niveles 8–12
          </strong>
          <span className="mt-1 block text-[10px] leading-[1.35] text-body-subtle max-[700px]:text-[8px]">
            Ventas, clientes y entorno
          </span>
        </div>
        <div className="pointer-events-none absolute top-[47%] right-[22px] max-w-[145px] text-[10px] text-body-subtle before:absolute before:top-[5px] before:left-[-30px] before:h-px before:w-[22px] before:bg-hairline-strong before:content-[''] min-[701px]:max-[1000px]:right-[12px] max-[1000px]:before:left-[-14px] max-[1000px]:before:w-[10px] max-[700px]:right-[9px] max-[700px]:max-w-[100px]">
          <strong className="font-medium text-body">
            Operación · Niveles 4–7
          </strong>
          <span className="mt-1 block text-[10px] leading-[1.35] text-body-subtle max-[700px]:text-[8px]">
            Operaciones y personas
          </span>
        </div>
        <div className="pointer-events-none absolute right-[22px] bottom-[63px] max-w-[145px] text-[10px] text-body-subtle before:absolute before:top-[5px] before:left-[-30px] before:h-px before:w-[22px] before:bg-hairline-strong before:content-[''] min-[701px]:max-[1000px]:right-[12px] max-[1000px]:before:left-[-14px] max-[1000px]:before:w-[10px] max-[700px]:right-[9px] max-[700px]:max-w-[100px]">
          <strong className="font-medium text-body">
            Cimientos · Niveles 1–3
          </strong>
          <span className="mt-1 block text-[10px] leading-[1.35] text-body-subtle max-[700px]:text-[8px]">
            Finanzas y liquidez
          </span>
        </div>
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 flex items-center justify-center gap-[7px] px-4 text-center text-[11px] text-body-subtle">
          <Hand size={15} className="shrink-0" /> {towerGuidance}
        </div>
      </div>
      {guideOpen && (
        <Modal
          title="Qué representa cada bloque"
          onClose={() => setGuideOpen(false)}
        >
          <p className="max-w-[42ch] text-sm leading-6 text-body-muted">
            El icono identifica la capacidad de la empresa. Su posición muestra
            de qué nivel depende.
          </p>
          <div className="space-y-6">
            {BLOCK_GUIDE.map((section) => (
              <section key={section.title}>
                <div className="mb-3 border-b border-hairline pb-2">
                  <h3 className="font-title text-sm font-semibold text-ink">
                    {section.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-body-muted">
                    {section.description}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  {section.items.map(({ label, meaning }) => (
                    <div
                      key={label}
                      className="flex min-h-[72px] items-start gap-3 rounded-lg border border-hairline bg-canvas/45 p-3"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-blue/8 text-brand-blue">
                        <Icon
                          iconNode={BLOCK_ICON_NODES[label]}
                          size={16}
                          strokeWidth={1.8}
                        />
                      </span>
                      <span>
                        <strong className="block text-xs font-medium text-body">
                          {label}
                        </strong>
                        <small className="mt-1 block text-[11px] leading-[1.35] text-body-subtle">
                          {meaning}
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Modal>
      )}
    </Card>
  );
}
