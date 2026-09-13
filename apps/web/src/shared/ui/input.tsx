import * as React from "react";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-hairline bg-surface-subtle px-3 py-2 text-sm text-ink shadow-geist-small outline-none transition-[border-color,box-shadow] placeholder:text-body-subtle file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink hover:border-hairline-strong focus-visible:border-brand-blue focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-50 aria-invalid:border-danger aria-invalid:outline-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
