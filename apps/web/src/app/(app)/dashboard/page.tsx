import {
  getActiveFocusSessionForUser,
  getAnalyticsSummaryForUser,
  getGamificationSummaryForUser,
  listFocusSessionsForUser,
  listHabitsWithStatsForUser,
  listTasksForUser,
} from "@ember/database";
import { AlertCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuthenticatedPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireAuthenticatedPage();

  if (!session.databaseReady || !session.userContext) {
    return (
      <Card className="border-rose/30 bg-rose/10">
        <CardContent className="flex items-start gap-3 p-6">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-text-primary">
              Database persistence unavailable
            </p>
            <p className="text-xs text-text-secondary">
              {session.databaseError ??
                "Check DATABASE_URL and run Drizzle migrations."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { profile, preferences } = session.userContext;
  if (!profile.onboardingCompleted) {
    redirect("/onboarding");
  }

  const [
    analytics,
    gamification,
    activeSession,
    recentSessions,
    tasks,
    habits,
  ] = await Promise.all([
    getAnalyticsSummaryForUser(profile.id, preferences.timezone),
    getGamificationSummaryForUser(profile.id),
    getActiveFocusSessionForUser(profile.id),
    listFocusSessionsForUser(profile.id, { limit: 10 }),
    listTasksForUser(profile.id),
    listHabitsWithStatsForUser(profile.id, preferences.timezone),
  ]);

  return (
    <DashboardWorkspace
      displayName={session.displayName}
      preferences={preferences}
      analytics={analytics}
      gamification={gamification}
      activeSession={activeSession}
      recentSessions={recentSessions}
      initialTasks={tasks}
      initialHabits={habits}
    />
  );
}
