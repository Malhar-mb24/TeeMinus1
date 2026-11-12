import {
  getActiveFocusSessionForUser,
  getGamificationSummaryForUser,
  listFocusSessionsForUser,
  listTasksForUser,
} from "@ember/database";
import { AlertCircle } from "lucide-react";
import { FocusTimerWorkspace } from "@/components/focus-timer-workspace";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuthenticatedPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FocusPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>;
}) {
  const session = await requireAuthenticatedPage();
  if (!session.databaseReady || !session.userContext) {
    return (
      <Card className="border-rose/30 bg-rose/10">
        <CardContent className="flex items-start gap-3 p-6">
          <AlertCircle className="h-5 w-5 text-rose shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">
            Database connection is required for focus session persistence.
          </p>
        </CardContent>
      </Card>
    );
  }

  const resolvedParams = await searchParams;
  const { profile, preferences } = session.userContext;

  const [activeSession, history, tasks, gamification] = await Promise.all([
    getActiveFocusSessionForUser(profile.id),
    listFocusSessionsForUser(profile.id, { limit: 25 }),
    listTasksForUser(profile.id),
    getGamificationSummaryForUser(profile.id),
  ]);

  return (
    <FocusTimerWorkspace
      initialActiveSession={activeSession}
      initialHistory={history}
      tasks={tasks}
      preferences={preferences}
      initialTaskId={resolvedParams.taskId ?? null}
      level={gamification.level}
    />
  );
}
