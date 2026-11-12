"use client";

import { SignOutButton, UserButton } from "@clerk/nextjs";
import {
  BarChart3,
  CheckSquare,
  Flame,
  Grid2x2Check,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import { EmberLogo } from "./ember-logo";
import { Badge } from "./ui/badge";

interface AppShellProps {
  children: React.ReactNode;
  displayName: string | null;
  email: string | null;
  clerkEnabled: boolean;
  databaseReady: boolean;
}

interface NavItem {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  batchTag?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Focus Timer", icon: Timer, batchTag: "B02" },
  { label: "Tasks & Plan", icon: CheckSquare, batchTag: "B02" },
  { label: "Habits", icon: Grid2x2Check, batchTag: "B03" },
  { label: "Wellbeing", icon: ShieldCheck, batchTag: "B04" },
  { label: "Insights", icon: BarChart3, batchTag: "B05" },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({
  children,
  displayName,
  email,
  clerkEnabled,
  databaseReady,
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-canvas text-text-primary flex flex-col md:flex-row">
      {/* Desktop Sidebar Rail */}
      <aside
        aria-label="Primary navigation"
        className="hidden md:flex md:w-64 lg:w-68 shrink-0 flex-col border-r border-border-subtle bg-surface/80 backdrop-blur-sm"
      >
        <div className="flex h-16 items-center justify-between border-b border-border-subtle px-5">
          <Link href="/dashboard" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame/60 rounded-xl">
            <EmberLogo />
          </Link>
          <Badge variant="neutral" className="text-[10px]">
            v0.1
          </Badge>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.href ? pathname.startsWith(item.href) : false;

            if (!item.href) {
              return (
                <div
                  key={item.label}
                  aria-disabled="true"
                  title={`${item.label} unlocks in ${item.batchTag}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-text-muted/75 cursor-not-allowed select-none"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  <span className="rounded-md border border-border-subtle bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-text-muted">
                    {item.batchTag}
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-flame/15 text-flame-soft border border-flame/25"
                    : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary border border-transparent"
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-flame" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border-subtle p-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-elevated/70 px-3 py-2 text-xs">
            <span className="flex items-center gap-2 text-text-secondary">
              <Flame className="h-3.5 w-3.5 text-flame" />
              Database
            </span>
            <span
              className={cn(
                "font-medium",
                databaseReady ? "text-emerald" : "text-rose"
              )}
            >
              {databaseReady ? "Connected" : "Unconfigured"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-elevated px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {clerkEnabled && <UserButton />}
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-text-primary">
                  {displayName ?? "Ember Member"}
                </p>
                {email && (
                  <p className="truncate text-[11px] text-text-muted">{email}</p>
                )}
              </div>
            </div>

            {clerkEnabled && (
              <SignOutButton redirectUrl="/">
                <button
                  type="button"
                  aria-label="Sign out"
                  title="Sign out"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </SignOutButton>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border-subtle bg-canvas/90 px-4 backdrop-blur-md md:hidden">
          <Link href="/dashboard" className="rounded-lg">
            <EmberLogo />
          </Link>

          <div className="flex items-center gap-2">
            <Badge variant={databaseReady ? "emerald" : "rose"} className="text-[11px]">
              {databaseReady ? "DB Ready" : "DB Offline"}
            </Badge>
            {clerkEnabled && <UserButton />}
          </div>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 sm:px-6 md:px-8 md:py-7 md:pb-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface/95 px-2 py-2 backdrop-blur-md md:hidden"
      >
        <div className="mx-auto flex max-w-md items-center justify-around gap-1">
          <Link
            href="/dashboard"
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors",
              pathname.startsWith("/dashboard")
                ? "bg-flame/15 text-flame-soft"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>

          <button
            type="button"
            disabled
            aria-label="Focus Timer (Batch 02)"
            className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] text-text-muted/60 cursor-not-allowed"
          >
            <Timer className="h-4 w-4" />
            <span>Focus · B02</span>
          </button>

          <button
            type="button"
            disabled
            aria-label="Habits (Batch 03)"
            className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] text-text-muted/60 cursor-not-allowed"
          >
            <Grid2x2Check className="h-4 w-4" />
            <span>Habits · B03</span>
          </button>

          <Link
            href="/settings"
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors",
              pathname.startsWith("/settings")
                ? "bg-flame/15 text-flame-soft"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
