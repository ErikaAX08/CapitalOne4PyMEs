import type { LucideIcon } from "lucide-react";

/** A section of the page the sidebar can scroll to. The identifier is the DOM
 *  id the view puts on the corresponding landmark. */
export interface ShellSection {
  id: string;
  label: string;
  icon: LucideIcon;
}

/** An in-page command the sidebar exposes next to the navigation: it opens a
 *  dialog or resets state, it does not change the route. */
export interface ShellTool {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Mirrors whatever guard the in-page control carries, so the sidebar cannot
   *  trigger a command the view itself has disabled. */
  disabled?: boolean;
}

/** The routes the application actually serves. The landing page (`/`) is not
 *  listed: it sits outside the shell. */
export interface ShellRoute {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}
