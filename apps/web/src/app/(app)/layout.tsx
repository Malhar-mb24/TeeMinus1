import { getGamificationSummaryForUser } from "@ember/database";
import { getEnvReadiness } from "@ember/shared";
import { AppShell } from "@/components/app-shell";
import { requireAuthenticatedPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAuthenticatedPage();
  const readiness = getEnvReadiness(process.env);

  let level = 1;
  let totalXp = 0;
  const theme = session.userContext?.preferences.theme ?? "ember-dark";

  if (session.databaseReady && session.userContext) {
    try {
      const gamification = await getGamificationSummaryForUser(
        session.userContext.profile.id
      );
      level = gamification.level;
      totalXp = gamification.totalXp;
    } catch {
      level = 1;
      totalXp = 0;
    }
  }

  return (
    <AppShell
      displayName={session.displayName}
      email={session.email}
      clerkEnabled={readiness.clerkConfigured}
      databaseReady={session.databaseReady}
      level={level}
      totalXp={totalXp}
      theme={theme}
    >
      {children}
    </AppShell>
  );
}
