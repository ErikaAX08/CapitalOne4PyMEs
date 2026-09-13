import type { ReactNode } from "react";
import { SidebarNav } from "./SidebarNav";
import { TopBar } from "./TopBar";
import type { ShellSection, ShellTool } from "../model/navigation";

/** The application chrome the two in-app views share: a fixed sidebar with the
 *  real destinations, the page's own sections and its in-page commands, and a
 *  top bar that names the view. The landing page (`/`) sits outside it. */
export function AppShell({
  eyebrow,
  title,
  subtitle,
  sections = [],
  sectionsLabel = "Mi negocio",
  tools = [],
  companySelector,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  sections?: ShellSection[];
  sectionsLabel?: string;
  companySelector?: ReactNode;
  tools?: ShellTool[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-canvas min-[1001px]:grid min-[1001px]:grid-cols-[264px_minmax(0,1fr)] min-[1001px]:items-start">
      <SidebarNav
        sections={sections}
        sectionsLabel={sectionsLabel}
        tools={tools}
      />
      <div className="min-w-0">
        <TopBar
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          tools={tools}
          companySelector={companySelector}
        />
        {children}
      </div>
    </div>
  );
}
