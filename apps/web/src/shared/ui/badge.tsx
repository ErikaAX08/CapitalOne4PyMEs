import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const badgeVariants = cva(
  "inline-flex min-h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-1 font-title text-xs font-medium tracking-normal whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        neutral: "border-hairline bg-surface-subtle text-body",
        success: "border-brand-blue/15 bg-success-soft text-success",
        warning: "border-warning/15 bg-warning-soft text-warning",
        danger: "border-danger/15 bg-danger-soft text-danger",
        info: "border-brand-blue/15 bg-info-soft text-info",
        brand: "border-brand-blue/15 bg-brand-blue-soft text-brand-blue",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
