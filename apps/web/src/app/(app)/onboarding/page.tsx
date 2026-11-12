import { OnboardingWizard } from "@/components/onboarding-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuthenticatedPage } from "@/lib/auth";
import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await requireAuthenticatedPage();
  const prefs = session.userContext?.preferences;

  if (!session.databaseReady || !prefs) {
    return (
      <Card className="border-rose/30 bg-rose/10">
        <CardContent className="flex items-start gap-3 p-6">
          <AlertCircle className="h-5 w-5 text-rose shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-text-primary">
              Database connection required for onboarding
            </p>
            <p className="text-xs text-text-secondary mt-1">
              {session.databaseError ?? "Configure DATABASE_URL and run Drizzle migrations."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <OnboardingWizard
      initialTimezone={prefs.timezone}
      initialDailyGoal={prefs.dailyFocusGoalMinutes}
      initialPomodoro={prefs.pomodoroMinutes}
      initialShortBreak={prefs.shortBreakMinutes}
      initialLongBreak={prefs.longBreakMinutes}
    />
  );
}
