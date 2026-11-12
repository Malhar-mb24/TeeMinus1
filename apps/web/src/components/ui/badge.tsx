import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight transition-colors",
  {
    variants: {
      variant: {
        neutral: "border-border-subtle bg-surface-elevated text-text-secondary",
        flame: "border-flame/30 bg-flame/15 text-flame-soft",
        emerald: "border-emerald/30 bg-emerald/15 text-emerald",
        sky: "border-sky/30 bg-sky/15 text-sky",
        rose: "border-rose/30 bg-rose/15 text-rose",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
