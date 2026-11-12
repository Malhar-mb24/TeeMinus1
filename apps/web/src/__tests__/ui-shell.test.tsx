import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { FlameCompanion } from "@/components/flame-companion";
import {
  computeClientElapsedSeconds,
  FocusTimerWorkspace,
} from "@/components/focus-timer-workspace";
import { HabitsWorkspace } from "@/components/habits-workspace";
import { SettingsPreferencesForm } from "@/components/settings-preferences-form";
import { WellbeingWorkspace } from "@/components/wellbeing-workspace";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="clerk-user-button" />,
  SignOutButton: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="clerk-sign-out">{children}</div>
  ),
}));

describe("Ember Batch 01 UI components", () => {
  it("renders responsive desktop and mobile navigation with level badge", () => {
    render(
      <AppShell
        displayName="Malhar"
        email="malhar@example.com"
        clerkEnabled={false}
        databaseReady={true}
        level={3}
        totalXp={350}
      >
        <div>Dashboard Content</div>
      </AppShell>
    );

    expect(screen.getByLabelText("Primary navigation")).toBeInTheDocument();
    expect(screen.getByLabelText("Mobile navigation")).toBeInTheDocument();
    expect(screen.getByText("Lv 3")).toBeInTheDocument();
    expect(screen.getByText("350 XP")).toBeInTheDocument();
  });

  it("renders SettingsPreferencesForm fields with default values", () => {
    render(<SettingsPreferencesForm initialPreferences={null} disabled={false} />);

    expect(screen.getByLabelText("IANA Timezone")).toHaveValue("UTC");
    expect(screen.getByLabelText("Pomodoro Duration (minutes)")).toHaveValue(25);
    expect(screen.getByRole("button", { name: "Save preferences" })).toBeEnabled();
  });

  it("renders 2D FlameCompanion states without shaming copy", () => {
    render(
      <FlameCompanion
        mood="celebration"
        styleVariant="ember-spark"
        level={2}
        message="Milestone reached!"
      />
    );
    expect(screen.getByLabelText("Ember companion feeling celebration")).toBeInTheDocument();
    expect(screen.getByText("Milestone reached!")).toBeInTheDocument();
    expect(screen.getByText("L2")).toBeInTheDocument();
  });

  it("recovers running timer elapsed time accurately from timestamps", () => {
    const startMs = Date.parse("2026-11-12T10:00:00.000Z");
    const elapsed = computeClientElapsedSeconds(
      {
        id: "sess-1",
        userId: "user-1",
        taskId: null,
        taskTitle: null,
        mode: "pomodoro",
        status: "running",
        plannedDurationSeconds: 1500,
        startedAt: "2026-11-12T09:50:00.000Z",
        lastResumedAt: "2026-11-12T10:00:00.000Z",
        accumulatedSeconds: 120,
        endedAt: null,
        localDate: "2026-11-12",
        label: "Algorithms",
        notes: null,
        soundscape: "none",
        xpEarned: 0,
        createdAt: "2026-11-12T09:50:00.000Z",
      },
      startMs + 180_000
    );

    expect(elapsed).toBe(300);

    render(
      <FocusTimerWorkspace
        initialActiveSession={null}
        initialHistory={[]}
        tasks={[]}
        level={1}
        preferences={{
          id: "pref-1",
          userId: "user-1",
          timezone: "UTC",
          theme: "ember-dark",
          pomodoroMinutes: 25,
          shortBreakMinutes: 5,
          longBreakMinutes: 15,
          dailyFocusGoalMinutes: 120,
          companionStyle: "classic-flame",
          soundscapePreference: "none",
          extensionTrackingConsent: false,
          extensionConsentUpdatedAt: null,
          notificationsEnabled: true,
          updatedAt: "2026-11-12T00:00:00.000Z",
        }}
      />
    );

    expect(screen.getByTestId("timer-display")).toHaveTextContent("25:00");
    expect(screen.getByRole("link", { name: /FlowTunes/i })).toHaveAttribute(
      "href",
      "https://www.flowtunes.app/index.html"
    );
  });

  it("switches cleanly between HabitKit-inspired Card, 5-Day Matrix, and Month views", () => {
    render(
      <HabitsWorkspace
        todayDate="2026-11-12"
        initialHabits={[
          {
            id: "hab-1",
            userId: "user-1",
            title: "Code & Learn",
            description: "Daily engineering practice",
            category: "Work",
            icon: "terminal",
            color: "#F97316",
            scheduleType: "daily",
            scheduledDays: [0, 1, 2, 3, 4, 5, 6],
            targetPerDay: 1,
            archived: false,
            createdAt: "2026-11-10T00:00:00.000Z",
            entries: [
              {
                id: "ent-1",
                habitId: "hab-1",
                localDate: "2026-11-12",
                status: "completed",
                progressCount: 1,
                note: null,
              },
            ],
            stats: {
              currentStreak: 1,
              bestStreak: 1,
              completedDays: 1,
              skippedDays: 0,
              missedDays: 0,
              completionRate: 100,
            },
          },
        ]}
      />
    );

    expect(screen.getByText("Code & Learn")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /5-Day/i }));
    expect(screen.getByText("1 HABITS")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Month/i }));
    expect(screen.getByText("2026-11")).toBeInTheDocument();
  });

  it("aligns monthly calendar dot grids with leading weekday padding cells", () => {
    render(
      <HabitsWorkspace
        todayDate="2026-12-05"
        initialHabits={[
          {
            id: "hab-dec",
            userId: "user-1",
            title: "Reading",
            description: null,
            category: "Betterment",
            icon: "book-open",
            color: "#10B981",
            scheduleType: "daily",
            scheduledDays: [0, 1, 2, 3, 4, 5, 6],
            targetPerDay: 1,
            archived: false,
            createdAt: "2026-12-01T00:00:00.000Z",
            entries: [],
            stats: {
              currentStreak: 0,
              bestStreak: 0,
              completedDays: 0,
              skippedDays: 0,
              missedDays: 4,
              completionRate: 0,
            },
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: /Month/i }));
    expect(screen.getByText("2026-12")).toBeInTheDocument();
    expect(screen.getByTitle("2026-12-01: pending")).toBeInTheDocument();
    expect(screen.getByTitle("2026-12-31: pending")).toBeInTheDocument();
  });

  it("renders Digital Wellbeing dashboard with websites, desktop apps, and device controls", () => {
    render(
      <WellbeingWorkspace
        initialSummary={{
          timezone: "UTC",
          todayDate: "2026-11-12",
          syncConsentEnabled: true,
          todayTotalSeconds: 5400,
          todayWebsiteSeconds: 3600,
          todayDesktopSeconds: 1800,
          todayFocusSeconds: 1500,
          rangeTotalSeconds: 5400,
          rangeDays: 7,
          categoryBreakdown: {
            productiveSeconds: 4200,
            neutralSeconds: 1200,
            distractingSeconds: 0,
          },
          dailyTrend: [
            {
              localDate: "2026-11-12",
              dayLabel: "Thu",
              websiteSeconds: 3600,
              desktopSeconds: 1800,
              totalSeconds: 5400,
              focusSeconds: 1500,
              productiveSeconds: 4200,
              neutralSeconds: 1200,
              distractingSeconds: 0,
            },
          ],
          topWebsites: [
            {
              targetType: "website",
              pattern: "github.com",
              displayName: "github.com",
              category: "productive",
              activeSeconds: 3600,
              count: 4,
              sharePercent: 100,
              lastUpdatedAt: "2026-11-12T10:00:00.000Z",
            },
          ],
          topDesktopApps: [
            {
              targetType: "desktop_app",
              pattern: "code.exe",
              displayName: "VS Code",
              category: "productive",
              activeSeconds: 1800,
              count: 2,
              sharePercent: 100,
              lastUpdatedAt: "2026-11-12T10:00:00.000Z",
            },
          ],
          devices: [
            {
              id: "dev-1",
              deviceName: "Work Chrome",
              deviceType: "chrome_extension",
              browser: "chrome",
              status: "active",
              lastSeenAt: "2026-11-12T10:00:00.000Z",
              revokedAt: null,
              createdAt: "2026-11-12T09:00:00.000Z",
            },
          ],
        }}
      />
    );

    expect(screen.getByText("Digital Wellbeing")).toBeInTheDocument();
    expect(screen.getByText("github.com")).toBeInTheDocument();
    expect(screen.getByText("Work Chrome")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Windows Apps/i }));
    expect(screen.getByText("VS Code")).toBeInTheDocument();
  });
});
