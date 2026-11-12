import { getWellbeingSummaryForUser } from "@ember/database";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WellbeingWorkspace } from "@/components/wellbeing-workspace";
import { requireAuthenticatedPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WellbeingPage() {
  const session = await requireAuthenticatedPage();
  if (!session.databaseReady || !session.userContext) {
    return (
      <Card className="border-rose/30 bg-rose/10">
        <CardContent className="flex items-start gap-3 p-6">
          <AlertCircle className="h-5 w-5 text-rose shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">
            Database connection is required for Digital Wellbeing analytics and device pairing.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { profile, preferences } = session.userContext;
  const summary = await getWellbeingSummaryForUser(profile.id, preferences.timezone, 7);

  return <WellbeingWorkspace initialSummary={summary} />;
}
