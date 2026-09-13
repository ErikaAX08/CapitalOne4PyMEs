import { formatMoney, Label } from "@shared";
import type { DeclarableVariable, DeclaredValues } from "@entities/company";

/** The Spanish each declarable variable reads as, and the unit it is entered
 *  in. The contract stays English (`payroll_cents`); this is the boundary. */
const FIELDS: Record<
  DeclarableVariable,
  { label: string; hint: string; unit: "money" | "days" | "share" }
> = {
  payroll_cents: {
    label: "Nómina por periodo",
    hint: "Lo que pagas a tu equipo cada quincena",
    unit: "money",
  },
  main_customer_concentration: {
    label: "Concentración del principal cliente",
    hint: "Qué porcentaje de tus ventas representa",
    unit: "share",
  },
  contracted_term_days: {
    label: "Plazo de cobro contratado",
    hint: "Los días que acordaste, no los que tardan",
    unit: "days",
  },
  average_collection_days: {
    label: "Plazo de cobro real",
    hint: "Lo que de verdad tardan en pagarte",
    unit: "days",
  },
  opening_balance_cents: {
    label: "Saldo disponible",
    hint: "El efectivo con el que arrancas",
    unit: "money",
  },
};

/** Collects the profile variables the database does not hold for this company.
 *
 *  Without them the engine abstains — it will not estimate on a profile it does
 *  not know — so this is not an optional extra: it is what the person
 *  simulating contributes. Each value is converted to the contract's unit here,
 *  at the edge, so nothing downstream sees pesos or percentages. */
export function DeclaredFields({
  missing,
  values,
  onChange,
  disabled,
}: {
  missing: DeclarableVariable[];
  values: DeclaredValues;
  onChange: (values: DeclaredValues) => void;
  disabled: boolean;
}) {
  if (missing.length === 0) return null;

  function set(id: DeclarableVariable, raw: string, unit: string) {
    const next = { ...values };
    const parsed = Number(raw);
    if (raw === "" || !Number.isFinite(parsed) || parsed < 0) {
      delete next[id];
    } else {
      next[id] =
        unit === "money"
          ? Math.round(parsed * 100)
          : unit === "share"
            ? Math.min(1, parsed / 100)
            : Math.round(parsed);
    }
    onChange(next);
  }

  function shown(id: DeclarableVariable, unit: string): string {
    const stored = values[id];
    if (stored === undefined) return "";
    if (unit === "money") return String(stored / 100);
    if (unit === "share") return String(Math.round(stored * 100));
    return String(stored);
  }

  return (
    <div>
      <span className="font-mono block text-[11px] font-medium tracking-normal text-body-muted uppercase">
        Completa el perfil
      </span>
      <p className="mt-[7px] text-[11px] leading-[1.7] text-body-muted">
        Esta empresa no registra{" "}
        {missing.length === 1 ? "este dato" : "estos datos"}. Sin{" "}
        {missing.length === 1 ? "él" : "ellos"} el motor no estima: prefiere
        decir que no sabe antes que inventar una cifra.
      </p>
      <div className="mt-[14px] grid gap-[12px]">
        {missing.map((id) => {
          const field = FIELDS[id];
          if (!field) return null;
          return (
            <Label
              key={id}
              className="block text-[12px] font-normal text-body-muted"
            >
              {field.label}
              <span className="float-right text-[10px] text-body-subtle">
                {field.unit === "money"
                  ? "MXN"
                  : field.unit === "days"
                    ? "días"
                    : "%"}
              </span>
              <input
                type="number"
                min="0"
                step={field.unit === "money" ? "1000" : "1"}
                inputMode="decimal"
                value={shown(id, field.unit)}
                onChange={(event) => set(id, event.target.value, field.unit)}
                disabled={disabled}
                aria-label={field.label}
                className="mt-[7px] h-[42px] w-full rounded-md border border-hairline bg-surface-subtle px-3 text-[14px] text-ink shadow-geist-small transition-colors hover:border-hairline-strong focus-visible:border-brand-blue focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-1"
              />
              <small className="mt-[5px] block text-[10px] text-body-subtle">
                {field.hint}
                {field.unit === "money" && values[id] !== undefined
                  ? ` · ${formatMoney(values[id]! / 100)}`
                  : ""}
              </small>
            </Label>
          );
        })}
      </div>
    </div>
  );
}
