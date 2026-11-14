import * as React from "react";
import { cn } from "@/lib/utils";

interface EmberLogoProps {
  compact?: boolean;
  className?: string;
}

export function EmberLogo({ compact = false, className }: EmberLogoProps) {
  const gradId = React.useId();

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-flame/30 bg-gradient-to-b from-flame/18 to-flame/5 shadow-[inset_0_1px_0_0_rgba(255,244,230,0.12)]">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12.35 2.5C12.35 2.5 16.5 6.4 16.5 10.6C16.5 11.75 16.1 12.75 15.45 13.55C15.95 12.65 16.1 11.7 15.75 10.8C15.1 12.35 13.75 13.25 12.45 13.75C12.45 13.75 13.25 11.95 12.45 10.2C11.9 9.05 10.95 8.3 10.95 8.3C10.95 8.3 11.2 10.1 10.25 11.45C9.4 12.65 8.2 13.3 8.2 15.1C8.2 17.6 10.15 19.75 12.65 19.95C15.65 20.2 18.2 17.9 18.2 14.85C18.2 10.4 14.2 5.3 12.35 2.5Z"
            fill={`url(#${gradId})`}
          />
          <path
            d="M12.2 14.2C11.05 14.95 10.5 16.1 10.75 17.25C11 18.35 11.95 19.1 13.05 19.1C14.3 19.1 15.3 18.1 15.3 16.8C15.3 15.35 13.7 14.5 12.2 14.2Z"
            fill="#FDE68A"
            fillOpacity="0.92"
          />
          <defs>
            <linearGradient
              id={gradId}
              x1="13"
              y1="2.5"
              x2="13"
              y2="20"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FFB45C" />
              <stop offset="0.55" stopColor="#F36B2B" />
              <stop offset="1" stopColor="#B94716" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="text-base font-semibold tracking-tight text-text-primary">
            Ember
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">
            Focus &amp; Wellbeing
          </span>
        </div>
      )}
    </div>
  );
}
