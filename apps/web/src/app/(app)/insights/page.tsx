import {
  getAnalyticsSummaryForUser,
  getFocusIntelligenceForUser,
  getGamificationSummaryForUser,
  getWellbeingSummaryForUser,
} from "@ember/database";
import type { CompanionStyle } from "@ember/shared";
import { AlertCircle } from "lucide-react";
import { InsightsWorkspace } from "@/components/insights-workspace";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuthenticatedPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const session = await requireAuthenticatedPage();
  if (!session.databaseReady || !session.userContext) {
    return (
      <Card className="border-rose/30 bg-rose/10">
        <CardContent className="flex items-start gap-3 p-6">
          <AlertCircle className="h-5 w-5 text-rose shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">
            Database connection is required for insights and gamification.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { profile, preferences } = session.userContext;
  const [analytics, gamification, wellbeing, intelligence] = await Promise.all([
    getAnalyticsSummaryForUser(profile.id, preferences.timezone),
    getGamificationSummaryForUser(profile.id),
    getWellbeingSummaryForUser(profile.id, preferences.timezone, 14),
    getFocusIntelligenceForUser(profile.id, preferences.timezone, 14),
  ]);

  return (
    <InsightsWorkspace
      analytics={analytics}
      initialGamification={gamification}
      initialCompanionStyle={preferences.companionStyle as CompanionStyle}
      wellbeing={wellbeing}
      intelligence={intelligence}
    />
  );
}
