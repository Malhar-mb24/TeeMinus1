import { expect, test } from "@playwright/test";

test.describe("Ember Batch 01 End-to-End Verification", () => {
  test("public landing page and auth navigation work cleanly on desktop and mobile", async ({
    page,
  }, testInfo) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.goto("/", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", {
        name: /Build consistent study habits without noise or gimmicks/i,
      })
    ).toBeVisible();

    const landingOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(landingOverflow).toBe(false);

    await page.screenshot({
      path: `test-results/landing-${testInfo.project.name}.png`,
      fullPage: true,
    });

    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    const signInOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(signInOverflow).toBe(false);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("unauthenticated users cannot access any protected Batch 01 pages", async ({
    page,
  }, testInfo) => {
    for (const route of [
      "/dashboard",
      "/onboarding",
      "/focus",
      "/tasks",
      "/habits",
      "/insights",
      "/wellbeing",
      "/settings",
    ]) {
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page).toHaveURL(/\/sign-in/);
    }

    await page.screenshot({
      path: `test-results/signin-redirect-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("all protected API routes enforce 401 and health API returns structured JSON", async ({
    request,
  }) => {
    const getEndpoints = [
      "/api/me",
      "/api/preferences",
      "/api/tasks",
      "/api/goals",
      "/api/focus-sessions",
      "/api/habits",
      "/api/analytics",
      "/api/gamification",
      "/api/export",
      "/api/devices",
      "/api/wellbeing",
      "/api/reminders",
      "/api/intelligence",
    ];

    for (const endpoint of getEndpoints) {
      const res = await request.get(endpoint);
      expect(res.status(), `Expected 401 on GET ${endpoint}`).toBe(401);
    }

    const remindersPutRes = await request.put("/api/reminders", {
      data: { notificationsEnabled: false },
    });
    expect(remindersPutRes.status()).toBe(401);

    const pairingCodeRes = await request.post("/api/devices/pairing-code", { data: {} });
    expect(pairingCodeRes.status()).toBe(401);

    const syncRes = await request.post("/api/wellbeing/sync", { data: { entries: [] } });
    expect(syncRes.status()).toBe(401);

    const catRes = await request.put("/api/wellbeing/categories", {
      data: { targetType: "website", pattern: "github.com", category: "productive" },
    });
    expect(catRes.status()).toBe(401);

    const clearRes = await request.delete("/api/wellbeing/data");
    expect(clearRes.status()).toBe(401);

    const onboardingRes = await request.post("/api/onboarding", { data: {} });
    expect(onboardingRes.status()).toBe(401);

    const prefsRes = await request.patch("/api/preferences", {
      data: { pomodoroMinutes: 30 },
    });
    expect(prefsRes.status()).toBe(401);

    const healthRes = await request.get("/api/health");
    expect([200, 503]).toContain(healthRes.status());

    const healthJson = (await healthRes.json()) as Record<string, unknown>;
    expect(["ok", "degraded"]).toContain(healthJson.status);
    expect(["connected", "unconfigured", "error"]).toContain(healthJson.database);
    expect(["configured", "unconfigured"]).toContain(healthJson.auth);
    expect(typeof healthJson.timestamp).toBe("string");
  });
});
