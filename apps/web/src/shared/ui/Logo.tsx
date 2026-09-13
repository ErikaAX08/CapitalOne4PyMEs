import { cn } from "../lib/utils";

/** The brand wordmark. Rendered by the landing header and by the application
 *  shell, so it carries its intrinsic dimensions in one place. */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/stackly-logo.png"
      alt="Stackly"
      width={872}
      height={270}
      className={cn("h-auto object-contain", className)}
    />
  );
}
