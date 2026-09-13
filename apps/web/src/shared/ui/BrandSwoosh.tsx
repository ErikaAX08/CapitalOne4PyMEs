import { cn } from "../lib/utils";

/** A quiet crop of the Stackly sweep, used only on blue brand surfaces. */
export function BrandSwoosh({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 160"
      fill="none"
      className={cn(
        "pointer-events-none absolute right-[-22px] top-[-18px] h-auto w-[78%] text-brand-blue-accent",
        className,
      )}
    >
      <path
        d="M9 78C86 18 198 1 316 18C215 23 118 46 36 98C20 108 11 101 9 78Z"
        fill="currentColor"
        fillOpacity="0.58"
      />
      <path
        d="M73 109C145 59 226 39 317 43C243 55 178 82 116 124C96 137 79 131 73 109Z"
        fill="currentColor"
        fillOpacity="0.34"
      />
    </svg>
  );
}
