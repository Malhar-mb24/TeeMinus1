import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { SettingsPreferencesForm } from "@/components/settings-preferences-form";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="clerk-user-button" />,
  SignOutButton: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="clerk-sign-out">{children}</div>
  ),
}));

describe("AppShell and SettingsPreferencesForm", () => {
  it("renders responsive desktop and mobile navigation inside AppShell", () => {
    render(
      <AppShell
        displayName="Malhar"
        email="malhar@example.com"
        clerkEnabled={false}
        databaseReady={true}
      >
        <div>Dashboard Content</div>
      </AppShell>
    );

    expect(screen.getByLabelText("Primary navigation")).toBeInTheDocument();
    expect(screen.getByLabelText("Mobile navigation")).toBeInTheDocument();
    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("renders SettingsPreferencesForm fields with default values", () => {
    render(<SettingsPreferencesForm initialPreferences={null} disabled={false} />);

    expect(screen.getByLabelText("IANA Timezone")).toHaveValue("UTC");
    expect(screen.getByLabelText("Pomodoro Duration (minutes)")).toHaveValue(25);
    expect(screen.getByRole("button", { name: "Save preferences" })).toBeEnabled();
  });
});
