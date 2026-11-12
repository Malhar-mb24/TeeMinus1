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

  return (
    <AppShell
      displayName={session.displayName}
      email={session.email}
      clerkEnabled={readiness.clerkConfigured}
      databaseReady={session.databaseReady}
    >
      {children}
    </AppShell>
  );
}
