import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Search } from "lucide-react";
import type { CompanySummary } from "@entities/company";
import { Badge, cn, formatMoney } from "@shared";
import { useCompanies } from "../model/useCompanies";

/** The company the whole shell is looking at, chosen from the header.
 *
 *  It lives here rather than inside a view because more than one view reads the
 *  selection, and because "which company am I looking at?" is a question the
 *  chrome should answer at all times, not one buried in a card. */
export function CompanySelect({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (companyId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const state = useCompanies(open || selected === "");
  const container = useRef<HTMLDivElement>(null);

  // The service's own default is selected on first load, so the header always
  // names the company being analysed instead of showing an empty control while
  // the backend quietly uses one.
  useEffect(() => {
    if (selected === "" && state.defaultCompany) {
      onSelect(state.defaultCompany);
    }
  }, [selected, state.defaultCompany, onSelect]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = state.companies.find((c) => c.companyId === selected);
  const label = current?.name ?? (selected || "Elige una empresa");

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Empresa seleccionada"
        className="flex h-10 max-w-[260px] items-center gap-[9px] rounded-md border border-hairline bg-surface-subtle px-3 text-left shadow-geist-small transition-colors hover:border-hairline-strong focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
      >
        <Building2 size={16} className="shrink-0 text-brand-blue" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold text-ink">
            {label}
          </span>
          {current && (
            <span className="block text-[10px] text-body-muted">
              {current.knownVariables}/{current.totalVariables} datos
            </span>
          )}
        </span>
        <ChevronDown size={15} className="shrink-0 text-body-subtle" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Empresas disponibles"
          className="absolute right-0 z-20 mt-2 w-[340px] rounded-xl border border-hairline bg-surface-subtle p-[12px] shadow-geist-floating max-[700px]:w-[min(340px,calc(100vw-32px))]"
        >
          <div className="flex items-center gap-2 rounded-md border border-hairline px-3 focus-within:border-brand-blue">
            <Search size={15} className="shrink-0 text-body-subtle" />
            <input
              type="search"
              autoFocus
              placeholder="Buscar empresa…"
              aria-label="Buscar empresa"
              value={state.filter.search ?? ""}
              onChange={(event) =>
                state.setFilter({ ...state.filter, search: event.target.value })
              }
              className="h-[38px] w-full min-w-0 border-0 bg-transparent text-[13px] text-ink outline-none"
            />
          </div>

          <div
            role="radiogroup"
            aria-label="Filtrar por desenlace"
            className="mt-[9px] flex gap-1"
          >
            {(
              [
                ["all", "Todas"],
                ["bankrupt", "Quebraron"],
                ["survivor", "Siguieron"],
              ] as const
            ).map(([value, text]) => {
              const active = (state.filter.outcome ?? "all") === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() =>
                    state.setFilter({ ...state.filter, outcome: value })
                  }
                  className={cn(
                    "rounded-md px-[10px] py-[5px] text-[11px] font-medium transition-colors",
                    active
                      ? "bg-brand-blue text-on-brand"
                      : "bg-surface-muted text-body hover:bg-hairline",
                  )}
                >
                  {text}
                </button>
              );
            })}
          </div>

          {state.error ? (
            <p
              role="alert"
              className="mt-[10px] border-l-4 border-danger bg-danger-soft p-[9px_11px] text-[11px] leading-[1.6] text-ink"
            >
              {state.error}
            </p>
          ) : (
            <ul className="mt-[10px] m-0 max-h-[300px] list-none overflow-y-auto p-0">
              {state.loading && state.companies.length === 0 && (
                <li className="p-[10px] text-[12px] text-body-muted">
                  Buscando…
                </li>
              )}
              {!state.loading && state.companies.length === 0 && (
                <li className="p-[10px] text-[12px] text-body-muted">
                  Ninguna coincide.
                </li>
              )}
              {state.companies.map((company) => (
                <Option
                  key={company.companyId}
                  company={company}
                  selected={company.companyId === selected}
                  isDefault={company.companyId === state.defaultCompany}
                  onSelect={() => {
                    onSelect(company.companyId);
                    setOpen(false);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Option({
  company,
  selected,
  isDefault,
  onSelect,
}: {
  company: CompanySummary;
  selected: boolean;
  isDefault: boolean;
  onSelect: () => void;
}) {
  const complete = (company.missing ?? []).length === 0;
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-[9px] rounded-md p-[9px_10px] text-left transition-colors",
          selected ? "bg-brand-blue-soft" : "hover:bg-surface-muted",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold text-ink">
            {company.name}
          </span>
          <span className="mt-0.5 block text-[10px] text-body-muted">
            {complete
              ? "Perfil completo"
              : `Faltan ${company.missing?.length} datos`}
            {company.openingBalanceCents !== undefined &&
              ` · ${formatMoney(company.openingBalanceCents / 100)}`}
          </span>
        </span>
        {isDefault && (
          <Badge
            variant="neutral"
            className="h-auto shrink-0 px-[6px] py-[2px] text-[9px]"
          >
            Demo
          </Badge>
        )}
        {company.bankrupt && (
          <Badge
            variant="danger"
            className="h-auto shrink-0 px-[6px] py-[2px] text-[9px]"
            title="Desenlace registrado, no una predicción"
          >
            Quebró
          </Badge>
        )}
        {selected && <Check size={15} className="shrink-0 text-brand-blue" />}
      </button>
    </li>
  );
}
