import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronRight,
  Gauge,
  LayoutDashboard,
  ReceiptText,
} from "lucide-react";
import { Button, Logo, cn } from "@shared";
import type { ShellTool } from "../model/navigation";

function Account() {
  return (
    <div className="flex items-center gap-[13px]">
      <div className="grid size-9 place-items-center rounded-full border border-hairline bg-surface-subtle text-xs font-medium text-ink">
        ML
      </div>
      <span className="text-[12px] font-semibold max-[700px]:hidden">
        Mariana Luna
        <small className="mt-1 block text-[11px] font-normal text-body-subtle">
          Administradora
        </small>
      </span>
    </div>
  );
}

/** Below the sidebar breakpoint the shell has no sidebar, so the routes and the
 *  in-page commands it holds are surfaced here instead. */
function CompactNav({ tools }: { tools: ShellTool[] }) {
  const { pathname } = useLocation();
  const routes = [
    { to: "/dashboard", label: "Panel", icon: LayoutDashboard },
    { to: "/movements", label: "Movimientos", icon: ReceiptText },
    { to: "/analysis", label: "Fragilidad", icon: Gauge },
  ].filter((route) => route.to !== pathname);
  return (
    <div className="-mx-1 flex flex-wrap items-center gap-1 min-[1001px]:hidden">
      {routes.map((route) => (
        <Button
          key={route.to}
          variant="ghost"
          size="compact"
          className="gap-[7px] text-[12px] no-underline hover:underline max-[700px]:text-[11px]"
          asChild
        >
          <Link to={route.to}>
            <route.icon size={16} /> {route.label}
          </Link>
        </Button>
      ))}
      {tools.map(({ label, icon: Icon, onClick, disabled }) => (
        <Button
          key={label}
          variant="ghost"
          size="compact"
          className="gap-[7px] text-[12px] no-underline hover:underline max-[700px]:text-[11px]"
          onClick={onClick}
          disabled={disabled}
        >
          <Icon size={16} /> {label}
        </Button>
      ))}
    </div>
  );
}

export function TopBar({
  eyebrow,
  title,
  subtitle,
  tools,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  tools: ShellTool[];
}) {
  const today = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return (
    <>
      <div className="flex h-14 items-center justify-between border-b border-hairline bg-canvas px-4 min-[1001px]:hidden">
        <Link to="/" aria-label="Ir al inicio">
          <Logo className="w-[175px]" />
        </Link>
      </div>
      <header
        className={cn(
          "flex items-start justify-between gap-6 p-[30px_32px_22px]",
          "max-[1000px]:p-[20px_16px_14px]",
        )}
      >
        <div className="min-w-0">
          <div className="font-mono mb-[10px] flex items-center gap-2 text-xs font-medium tracking-normal text-body-muted uppercase max-[700px]:text-[11px]">
            Mi negocio <ChevronRight size={12} aria-hidden="true" /> {eyebrow}
          </div>
          <h1 className="font-title text-[2rem] leading-10 font-semibold tracking-[-0.04em] max-[1000px]:text-[1.75rem] max-[700px]:text-2xl max-[700px]:leading-8">
            {title}
          </h1>
          <p className="mt-[9px] text-[13px] text-body-muted max-[700px]:text-[11px] max-[700px]:leading-[1.7]">
            {subtitle && (
              <>
                {subtitle}
                <span className="mx-2 text-body-subtle max-[700px]:hidden">
                  ·
                </span>
              </>
            )}
            <span className="text-body-subtle first-letter:uppercase max-[700px]:mt-1 max-[700px]:block">
              {today}
            </span>
          </p>
          <CompactNav tools={tools} />
        </div>
        <div className="flex shrink-0 items-center gap-[13px] max-[1000px]:hidden">
          <Account />
        </div>
      </header>
    </>
  );
}
