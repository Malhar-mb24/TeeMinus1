import { requireAuthenticatedApiSession } from "@/lib/api-auth";
import {
  getAnalyticsSummaryForUser,
  getReminderSettingsForUser,
  listHabitsWithStatsForUser,
  upsertReminderSettingsForUser,
} from "@ember/database";
import { getDayOfWeekFromDateKey, reminderSettingsSchema } from "@ember/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  const { profile, preferences } = authResult.userContext;
  const [settings, analytics, habits] = await Promise.all([
    getReminderSettingsForUser(profile.id),
    getAnalyticsSummaryForUser(profile.id, preferences.timezone),
    listHabitsWithStatsForUser(profile.id, preferences.timezone),
  ]);

  const todayDow = getDayOfWeekFromDateKey(analytics.todayDate);
  const incompleteHabitsTodayCount = habits.filter((h) => {
    if (h.archived || !h.scheduledDays.includes(todayDow)) return false;
    const todayEntry = h.entries.find((e) => e.localDate === analytics.todayDate);
    return !todayEntry || todayEntry.status !== "completed";
  }).length;

  return NextResponse.json({
    settings,
    context: {
      timezone: preferences.timezone,
      todayDate: analytics.todayDate,
      todayFocusMinutes: analytics.daily.focusMinutes,
      dailyFocusGoalMinutes: analytics.daily.dailyGoalMinutes,
      incompleteHabitsTodayCount,
    },
  });
}

export async function PUT(request: Request) {
  const authResult = await requireAuthenticatedApiSession();
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = reminderSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid reminder preferences payload",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const saved = await upsertReminderSettingsForUser(
    authResult.userContext.profile.id,
    parsed.data
  );

  return NextResponse.json({ settings: saved });
}
