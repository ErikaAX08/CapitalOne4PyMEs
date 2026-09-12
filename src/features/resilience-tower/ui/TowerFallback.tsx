import type { ReactNode } from "react";
export function TowerFallback({ children }: { children: ReactNode }) {
  return <div className="scene-fallback">{children}</div>;
}
