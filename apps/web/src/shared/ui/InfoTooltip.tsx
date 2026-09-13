import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "../lib/utils";

/** A definition attached to a figure.
 *
 *  Every headline number in this interface carries one: a large number without
 *  a definition is exactly the figure a reviewer asks you to justify. It opens
 *  on hover and on focus, and closes on Escape, so it is reachable by keyboard
 *  and not only by pointer. */
export function InfoTooltip({
  label,
  children,
  className,
  align = "start",
}: {
  /** What the icon describes, for screen readers. */
  label: string;
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <span
      ref={container}
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className="grid size-4 place-items-center rounded-full text-body-subtle transition-colors hover:text-brand-blue"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
      >
        <Info size={13} aria-hidden="true" />
      </button>
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className={cn(
          "absolute top-[calc(100%+8px)] z-30 w-[min(20rem,70vw)] rounded-md border border-hairline bg-surface-subtle p-3 text-[11px] leading-[1.6] font-normal text-body shadow-geist-floating",
          align === "start" ? "left-0" : "right-0",
        )}
      >
        {children}
      </span>
    </span>
  );
}
