import { SignOutButton } from "@clerk/nextjs";
import { getReminderSettingsForUser } from "@ember/database";
import { DEFAULT_REMINDER_SETTINGS, getEnvReadiness } from "@ember/shared";
import { ArrowRight, Bell, Download, Laptop, LogOut, Shield, SlidersHorizontal, UserCheck } from "lucide-react";
import Link from "next/link";
import { SettingsPreferencesForm } from "@/components/settings-preferences-form";
import { SettingsRemindersCard } from "@/components/settings-reminders-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuthenticatedPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireAuthenticatedPage();
  const readiness = getEnvReadiness(process.env);
  const prefs = session.userContext?.preferences ?? null;
  const profile = session.userContext?.profile ?? null;
  const reminderSettings =
    session.databaseReady && profile
      ? await getReminderSettingsForUser(profile.id)
      : DEFAULT_REMINDER_SETTINGS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
          Settings &amp; Privacy
        </h1>
        <p className="text-sm text-text-secondary">
          Manage your focus defaults, timezone, and extension privacy consent.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Preferences Form */}
        <div className="space-y-6 lg:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-flame-soft" />
                Workspace Preferences
              </CardTitle>
              <CardDescription>
                Changes persist directly to PostgreSQL under your authenticated profile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsPreferencesForm
                initialPreferences={prefs}
                disabled={!session.databaseReady}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-flame-soft" />
                Reminders &amp; Quiet Hours
              </CardTitle>
              <CardDescription>
                Configure consent-gated focus, break, goal, and habit reminders with in-app
                fallback when browser notifications are blocked or unavailable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsRemindersCard
                initialSettings={reminderSettings}
                disabled={!session.databaseReady}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Account & Extension Placeholder */}
        <div className="space-y-6 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald" />
                Account Identity
              </CardTitle>
              <CardDescription>
                Authenticated by Clerk; ownership enforced server-side.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                <p className="text-text-muted">Display Name</p>
                <p className="mt-0.5 font-medium text-text-primary">
                  {session.displayName ?? "Not set"}
                </p>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                <p className="text-text-muted">Email</p>
                <p className="mt-0.5 truncate font-medium text-text-primary">
                  {session.email ?? "Not available"}
                </p>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                <p className="text-text-muted">Database User ID</p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-text-secondary">
                  {profile?.id ?? "Unavailable"}
                </p>
              </div>

              <Button asChild variant="secondary" className="w-full">
                <a href="/api/export" download="ember-export.json">
                  <Download className="h-4 w-4" />
                  Export Personal Data (JSON)
                </a>
              </Button>

              {readiness.clerkConfigured && (
                <SignOutButton redirectUrl="/">
                  <Button variant="outline" className="w-full">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </SignOutButton>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Laptop className="h-4 w-4 text-sky" />
                  Connected Trackers
                </CardTitle>
                <Badge variant={prefs?.extensionTrackingConsent ? "emerald" : "neutral"}>
                  {prefs?.extensionTrackingConsent ? "Sync On" : "Local Only"}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Manage Chrome extension and Windows desktop app pairing codes or revoke
                tokens anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-border-subtle bg-surface-elevated/40 p-3.5 text-xs text-text-muted">
                <Shield className="h-4 w-4 shrink-0 text-text-muted" />
                <span>
                  {session.userContext?.extensionDeviceCount ?? 0} paired device(s)
                </span>
              </div>
              <Button asChild variant="secondary" size="sm" className="w-full">
                <Link href="/wellbeing">
                  Manage Wellbeing &amp; Devices
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
