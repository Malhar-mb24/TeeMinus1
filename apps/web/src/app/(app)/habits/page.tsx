import { listHabitsWithStatsForUser } from "@ember/database";
import { getLocalDateKey } from "@ember/shared";
import { AlertCircle } from "lucide-react";
import { HabitsWorkspace } from "@/components/habits-workspace";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuthenticatedPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const session = await requireAuthenticatedPage();
  if (!session.databaseReady || !session.userContext) {
    return (
      <Card className="border-rose/30 bg-rose/10">
        <CardContent className="flex items-start gap-3 p-6">
          <AlertCircle className="h-5 w-5 text-rose shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">
            Database connection is required for habit tracking.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { profile, preferences } = session.userContext;
  const todayDate = getLocalDateKey(new Date(), preferences.timezone);
  const habits = await listHabitsWithStatsForUser(profile.id, preferences.timezone);

  return <HabitsWorkspace initialHabits={habits} todayDate={todayDate} />;
}
