import { RotateCcw, Play } from "lucide-react";
import {
  ACTIONS,
  ACTION_KINDS,
  STRESS_PARAMETERS,
  type ActionKind,
  type ParameterValue,
  type ParameterValues,
} from "@entities/analysis";
import { Button, cn } from "@shared";
import { ParameterControl } from "./ParameterControl";

/** Module B -- Sandbox simulator (PRD 3.2).
 *
 *  Three blocks, left to right: which decision, its parameters, and the stress
 *  applied on top of it. Every control is generated from
 *  contracts/actions.schema.json, so the five decisions cost one component. */
export function DecisionSandbox({
  action,
  parameters,
  stress,
  running,
  onActionChange,
  onParameterChange,
  onStressChange,
  onRun,
  onReset,
}: {
  action: ActionKind;
  parameters: ParameterValues;
  stress: ParameterValues;
  running: boolean;
  onActionChange: (kind: ActionKind) => void;
  onParameterChange: (id: string, value: ParameterValue) => void;
  onStressChange: (id: string, value: ParameterValue) => void;
  onRun: () => void;
  onReset: () => void;
}) {
  const specs = ACTIONS[action]?.parameters ?? [];

  return (
    <section
      aria-labelledby="sandbox-heading"
      className="rounded-xl border border-hairline bg-canvas p-[24px_28px]"
    >
      <div className="mb-5 flex items-end justify-between gap-4 max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-2">
        <div>
          <span className="font-mono text-[11px] tracking-normal text-body-muted uppercase">
            Simulador
          </span>
          <h2
            id="sandbox-heading"
            className="font-title mt-1 text-2xl font-semibold tracking-[-0.04em]"
          >
            Prueba una decisión con tus cifras
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onReset} disabled={running}>
            <RotateCcw size={14} /> Restablecer
          </Button>
          <Button onClick={onRun} disabled={running}>
            <Play size={14} /> Ejecutar Simulación
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)_minmax(0,1fr)] gap-7 max-[1000px]:grid-cols-1 max-[1000px]:gap-6">
        <Block title="Decisión">
          <ul className="flex flex-col gap-1.5">
            {ACTION_KINDS.map((kind) => (
              <li key={kind}>
                <button
                  type="button"
                  aria-pressed={kind === action}
                  disabled={running}
                  onClick={() => onActionChange(kind)}
                  className={cn(
                    "w-full rounded-lg border p-[9px_12px] text-left text-[12px] font-medium transition-colors duration-200",
                    kind === action
                      ? "border-brand-blue/25 bg-brand-blue-soft text-brand-blue"
                      : "border-hairline bg-surface-subtle text-body hover:border-hairline-strong/40",
                  )}
                >
                  {ACTIONS[kind].label}
                </button>
              </li>
            ))}
          </ul>
          {ACTIONS[action]?.hint && (
            <p className="mt-3 text-[10px] leading-[1.6] text-body-subtle">
              {ACTIONS[action].hint}
            </p>
          )}
        </Block>

        <Block title="Parámetros">
          {specs.length === 0 ? (
            <p className="text-[12px] text-body-muted">
              La operación actual no tiene parámetros: es tu negocio tal como
              está hoy.
            </p>
          ) : (
            <div className="divide-y divide-hairline">
              {specs.map((spec) => (
                <ParameterControl
                  key={spec.id}
                  spec={spec}
                  value={parameters[spec.id] ?? spec.default}
                  disabled={running}
                  onChange={(value) => onParameterChange(spec.id, value)}
                />
              ))}
            </div>
          )}
        </Block>

        <Block title="Estrés">
          <div className="divide-y divide-hairline">
            {STRESS_PARAMETERS.map((spec) => (
              <ParameterControl
                key={spec.id}
                spec={spec}
                value={stress[spec.id] ?? spec.default}
                disabled={running}
                onChange={(value) => onStressChange(spec.id, value)}
              />
            ))}
          </div>
        </Block>
      </div>
    </section>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h3 className="font-mono mb-3 text-[10px] tracking-normal text-body-subtle uppercase">
        {title}
      </h3>
      {children}
    </div>
  );
}
