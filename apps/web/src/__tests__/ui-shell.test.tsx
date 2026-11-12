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
});
