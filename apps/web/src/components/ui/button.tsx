import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame/60 active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none min-h-10",
  {
    variants: {
      variant: {
        ember:
          "bg-gradient-to-b from-flame to-[#E25F12] text-[#140C07] font-semibold hover:from-flame-soft hover:to-flame shadow-[0_8px_20px_-10px_rgba(249,115,22,0.55),inset_0_1px_0_0_rgba(255,237,213,0.3)]",
        primary:
          "bg-text-primary text-canvas font-semibold hover:bg-[#FFF9F0]",
        secondary:
          "bg-surface-elevated text-text-primary border border-border-subtle hover:bg-surface-hover hover:border-border-strong",
        outline:
          "border border-border-subtle bg-transparent text-text-primary hover:bg-surface-elevated/80 hover:border-border-strong",
        ghost:
          "text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
        destructive:
          "bg-rose/12 text-rose border border-rose/30 hover:bg-rose/22",
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
