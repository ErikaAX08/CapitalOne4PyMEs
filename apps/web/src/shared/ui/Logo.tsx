import { cn } from "../lib/utils";

/** The brand wordmark. Rendered by the landing header and by the application
 *  shell, so it carries its intrinsic dimensions in one place. */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/capital-one-for-pymes.png"
      alt="Capital One For PyMES"
      width={738}
      height={136}
      className={cn("h-auto object-contain", className)}
    />
  );
}
