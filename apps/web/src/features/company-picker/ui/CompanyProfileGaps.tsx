import { TriangleAlert } from "lucide-react";
import {
  declarationComplete,
  type DeclarableVariable,
  type DeclaredValues,
} from "@entities/company";
import { Card } from "@shared";
import { useCompanies } from "../model/useCompanies";
import { DeclaredFields } from "./DeclaredFields";

/** Collects what the selected company's profile is missing.
 *
 *  The company itself is chosen in the header; this is only about making the
 *  analysis possible for it. It renders nothing when the profile is already
 *  complete, so the company the product ships with — the one that answers every
 *  action out of the box — shows no ceremony at all. */
export function CompanyProfileGaps({
  companyId,
  declared,
  running,
  abstaining,
  onDeclare,
}: {
  companyId: string;
  declared: DeclaredValues;
  running: boolean;
  /** The engine's own verdict on the last run, never a threshold recomputed
   *  here: the catalogue counts fewer variables than the engine sees, so a
   *  local rule would contradict the result on screen. */
  abstaining: boolean;
  onDeclare: (values: DeclaredValues) => void;
}) {
  const state = useCompanies(true);
  const current = state.companies.find((c) => c.companyId === companyId);
  const missing = (current?.missing ?? []) as DeclarableVariable[];
  if (!current || missing.length === 0) return null;

  const incomplete = !declarationComplete(current, declared);

  return (
    <section id="empresa" aria-label="Datos faltantes de la empresa">
      <Card className="gap-0 p-[22px] max-[700px]:p-[18px]">
        <DeclaredFields
          missing={missing}
          values={declared}
          onChange={onDeclare}
          disabled={running}
        />
        {abstaining && (
          <p
            className="mt-[16px] flex items-start gap-[9px] border-l-4 border-warning bg-warning-soft/50 p-[11px_13px] text-[11px] leading-[1.7] text-ink"
            role="status"
          >
            <TriangleAlert
              size={16}
              className="mt-[2px] shrink-0 text-warning"
            />
            <span>
              El motor se abstiene: faltan datos de {current.name}.
              {incomplete
                ? " Completa los campos de arriba para que pueda estimar."
                : " Ni con lo que declaraste alcanza la cobertura mínima."}
            </span>
          </p>
        )}
      </Card>
    </section>
  );
}
