import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-sm font-title text-sm font-medium tracking-normal whitespace-nowrap border border-transparent outline-none select-none transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "border-brand-blue bg-brand-blue text-on-brand shadow-geist-small hover:border-brand-blue-hover hover:bg-brand-blue-hover active:border-brand-blue-pressed active:bg-brand-blue-pressed",
        secondary:
          "border-hairline bg-surface-subtle text-ink shadow-geist-small hover:border-hairline-strong hover:bg-surface-muted active:bg-hairline",
        tertiary:
          "bg-surface-muted text-ink hover:bg-hairline active:bg-hairline-strong/30",
        danger:
          "border-danger bg-danger text-on-brand hover:border-brand-red-hover hover:bg-brand-red-hover active:bg-brand-red-hover",
        ghost:
          "bg-transparent text-body hover:bg-surface-muted hover:text-ink active:bg-hairline",
        link: "bg-transparent p-0 text-brand-blue underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4",
        compact: "h-10 px-3 text-sm",
        icon: "size-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
