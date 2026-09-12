import { expect, test } from "@playwright/test";

test("renders the Polish public application shell", async ({ page }) => {
  await page.goto("/pl");
  await expect(page.locator('header[role="banner"]')).toBeVisible();
  await expect(page.locator("#theme-toggle")).toBeVisible();
  await expect(page.getByRole("region", { name: "Wybór języka interfejsu" })).toBeVisible();
  await expect(page.locator("#signin-email, #onboarding-name")).toBeVisible({ timeout: 30_000 });
  if (await page.locator("#signin-email").count()) {
    await expect(page.locator("#signin-email")).toBeVisible();
    await expect(page.locator("#signin-password")).toBeVisible();
  } else {
    await expect(page.locator("#onboarding-name")).toBeVisible();
    await expect(page.locator("#onboarding-person")).toBeVisible();
  }

  // Ensure authenticated navigation and metrics are strictly absent for unauthenticated visitors
  await expect(page.getByRole("navigation", { name: "Główna nawigacja" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Konta" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Kategorie" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Gospodarstwo domowe" })).toHaveCount(0);
});

test("renders the English public application shell", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator('header[role="banner"]')).toBeVisible();
  await expect(page.locator("#theme-toggle")).toBeVisible();
  await expect(page.getByRole("region", { name: "Interface language selection" })).toBeVisible();
  await expect(page.locator("#signin-email, #onboarding-name")).toBeVisible({ timeout: 30_000 });
  if (await page.locator("#signin-email").count()) {
    await expect(page.locator("#signin-email")).toBeVisible();
    await expect(page.locator("#signin-password")).toBeVisible();
  } else {
    await expect(page.locator("#onboarding-name")).toBeVisible();
    await expect(page.locator("#onboarding-person")).toBeVisible();
  }

  // Ensure authenticated navigation and metrics are strictly absent for unauthenticated visitors
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Accounts" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Categories" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Household" })).toHaveCount(0);
});

test("switches between Polish and English", async ({ page }) => {
  await page.goto("/pl");
  await expect(page.getByRole("region", { name: "Wybór języka interfejsu" })).toBeVisible();
  await page.getByRole("button", { name: "Przełącz na język angielski" }).click();
  await expect(page).toHaveURL(/\/en/);
  await expect(page.getByRole("region", { name: "Interface language selection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to Polish" })).toBeVisible();
});

test("toggles theme between light and dark", async ({ page }) => {
  await page.goto("/pl");
  const html = page.locator("html");

  // Defaults to light mode
  await expect(html).not.toHaveClass(/dark/);

  // Toggle to dark mode
  await page.locator("#theme-toggle").click();
  await expect(html).toHaveClass(/dark/);

  const themeCookie = await page.context().cookies();
  const foundCookie = themeCookie.find((c) => c.name === "nodvis_theme");
  expect(foundCookie?.value).toBe("dark");

  // Toggle back to light mode
  await page.locator("#theme-toggle").click();
  await expect(html).not.toHaveClass(/dark/);

  const themeCookieAfter = await page.context().cookies();
  const foundCookieAfter = themeCookieAfter.find((c) => c.name === "nodvis_theme");
  expect(foundCookieAfter?.value).toBe("light");
});
