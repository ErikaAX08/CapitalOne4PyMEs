import type { ReactNode } from "react";
export function TowerFallback({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-full place-items-center p-10 text-center text-[14px] leading-[1.8] text-[#7087a1]">
      {children}
    </div>
  );
}
