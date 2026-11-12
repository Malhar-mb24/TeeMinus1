import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame/60 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none min-h-10",
  {
    variants: {
      variant: {
        ember:
          "bg-flame text-canvas font-semibold hover:bg-flame-soft shadow-[0_0_20px_-6px_rgba(249,115,22,0.5)]",
        primary:
          "bg-text-primary text-canvas font-semibold hover:bg-white",
        secondary:
          "bg-surface-elevated text-text-primary border border-border-subtle hover:bg-surface-hover hover:border-border-strong",
        outline:
          "border border-border-subtle bg-transparent text-text-primary hover:bg-surface-elevated hover:border-border-strong",
        ghost:
          "text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
        destructive:
          "bg-rose/15 text-rose border border-rose/30 hover:bg-rose/25",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-6 text-sm",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
