import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-none font-title text-[0.9375rem] font-semibold tracking-[-0.04em] whitespace-nowrap outline-none select-none transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-blue text-on-brand hover:bg-brand-blue-hover active:bg-brand-blue-pressed",
        secondary:
          "border border-brand-blue bg-canvas text-brand-blue hover:bg-brand-blue-soft",
        tertiary: "bg-transparent px-0 text-brand-blue hover:underline",
        danger: "bg-danger text-on-brand hover:bg-danger/90",
        ghost:
          "border border-hairline-strong bg-canvas text-body hover:bg-surface-subtle",
        link: "bg-transparent p-0 text-brand-blue underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-[1.125rem]",
        compact: "h-[2.375rem] px-3 text-[0.8125rem]",
        icon: "size-11",
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
