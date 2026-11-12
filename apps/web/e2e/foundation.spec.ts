import { expect, test } from "@playwright/test";

test.describe("Ember Batch 00 Foundation Smoke Suite", () => {
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

  test("unauthenticated users cannot access protected dashboard or settings", async ({
    page,
  }, testInfo) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/sign-in/);

    await page.screenshot({
      path: `test-results/signin-redirect-${testInfo.project.name}.png`,
      fullPage: true,
    });

    await page.goto("/settings", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("protected APIs enforce 401 and health API returns structured JSON", async ({
    request,
  }) => {
    const meRes = await request.get("/api/me");
    expect(meRes.status()).toBe(401);

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
