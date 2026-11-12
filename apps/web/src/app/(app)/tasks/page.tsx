import {
  getActiveGoalsForUser,
  listFocusSessionsForUser,
  listTasksForUser,
} from "@ember/database";
import { getLocalDateKey } from "@ember/shared";
import { AlertCircle } from "lucide-react";
import { TasksPlannerWorkspace } from "@/components/tasks-planner-workspace";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuthenticatedPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await requireAuthenticatedPage();
  if (!session.databaseReady || !session.userContext) {
    return (
      <Card className="border-rose/30 bg-rose/10">
        <CardContent className="flex items-start gap-3 p-6">
          <AlertCircle className="h-5 w-5 text-rose shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">
            Database connection is required for tasks and goals.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { profile, preferences } = session.userContext;
  const todayDate = getLocalDateKey(new Date(), preferences.timezone);

  const [tasks, goals, sessions] = await Promise.all([
    listTasksForUser(profile.id),
    getActiveGoalsForUser(profile.id, preferences.timezone),
    listFocusSessionsForUser(profile.id, { limit: 100 }),
  ]);

  return (
    <TasksPlannerWorkspace
      initialTasks={tasks}
      initialGoals={goals}
      initialSessions={sessions}
      todayDate={todayDate}
      timezone={preferences.timezone}
    />
  );
}
