import { useReducedMotion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Gauge,
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { Button, Logo, cn } from "@shared";
import type { ShellRoute, ShellSection, ShellTool } from "../model/navigation";

/** Every destination the application actually serves inside the shell. */
const ROUTES: ShellRoute[] = [
  {
    to: "/dashboard",
    label: "Panel de estabilidad",
    description: "Resumen, estructura y decisiones",
    icon: LayoutDashboard,
  },
  {
    to: "/movements",
    label: "Movimientos",
    description: "El libro de entradas y salidas",
    icon: ReceiptText,
  },
  {
    to: "/analysis",
    label: "Fragilidad estructural",
    description: "Qué se debilita antes de decidir",
    icon: Gauge,
  },
];

function GroupLabel({ children }: { children: string }) {
  return (
    <span className="font-mono mb-2 block px-3 text-[10px] font-medium tracking-normal text-body-subtle uppercase">
      {children}
    </span>
  );
}

const ITEM =
  "flex w-full items-center gap-[10px] rounded-md px-3 py-[9px] text-left text-[13px] font-medium transition-colors";

export function SidebarNav({
  sections,
  sectionsLabel,
  tools,
}: {
  sections: ShellSection[];
  sectionsLabel: string;
  tools: ShellTool[];
}) {
  const { pathname } = useLocation();
  const reduced = !!useReducedMotion();
  // The promo card points somewhere the reader is not.
  const promo = ROUTES.find((route) => route.to !== pathname) ?? ROUTES[0];

  function goToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: reduced ? "instant" : "smooth",
      block: "start",
    });
  }

  return (
    <aside className="hidden border-r border-hairline bg-surface-subtle min-[1001px]:sticky min-[1001px]:top-0 min-[1001px]:flex min-[1001px]:h-dvh min-[1001px]:flex-col min-[1001px]:gap-7 min-[1001px]:overflow-y-auto min-[1001px]:p-[26px_18px_22px]">
      <Link to="/" className="px-2" aria-label="Ir al inicio">
        <Logo className="w-[170px]" />
      </Link>

      <nav className="flex flex-col gap-6" aria-label="Navegación principal">
        <div>
          <GroupLabel>Menú</GroupLabel>
          <ul className="flex list-none flex-col gap-1 p-0">
            {ROUTES.map(({ to, label, icon: Icon }) => {
              const current = pathname === to;
              return (
                <li key={to}>
                  <Link
                    to={to}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      ITEM,
                      "no-underline",
                      current
                        ? "bg-brand-blue text-on-brand"
                        : "text-body hover:bg-surface-muted hover:text-ink",
                    )}
                  >
                    <Icon size={17} className="shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {sections.length > 0 && (
          <div>
            <GroupLabel>{sectionsLabel}</GroupLabel>
            <ul className="flex list-none flex-col gap-1 p-0">
              {sections.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => goToSection(id)}
                    className={cn(
                      ITEM,
                      "bg-transparent text-body hover:bg-surface-muted hover:text-ink",
                    )}
                  >
                    <Icon size={17} className="shrink-0 text-body-subtle" />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tools.length > 0 && (
          <div>
            <GroupLabel>Herramientas</GroupLabel>
            <ul className="flex list-none flex-col gap-1 p-0">
              {tools.map(({ label, icon: Icon, onClick, disabled }) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    className={cn(
                      ITEM,
                      "bg-transparent text-body hover:bg-surface-muted hover:text-ink",
                      "disabled:pointer-events-none disabled:opacity-50",
                    )}
                  >
                    <Icon size={17} className="shrink-0 text-body-subtle" />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      <div className="mt-auto rounded-xl bg-brand-blue p-[18px_17px] text-on-brand">
        <ShieldCheck size={19} />
        <strong className="font-title mt-[11px] block text-[15px] leading-[1.35] font-semibold tracking-[-0.02em]">
          Lleva tu negocio
          <br />
          más lejos
        </strong>
        <small className="mt-[7px] block text-[11px] leading-[1.6] text-on-brand/75">
          {promo.description}.
        </small>
        <Button
          variant="secondary"
          size="compact"
          className="mt-[14px] w-full justify-between gap-2 text-[12px]"
          asChild
        >
          <Link to={promo.to}>
            {promo.label} <ArrowRight size={15} />
          </Link>
        </Button>
      </div>
    </aside>
  );
}
