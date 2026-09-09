import { expect, test } from "@playwright/test";

const password = "LocalOnly-E2E-Password-123!";

test("authenticated shell keeps controls calm and language in settings", async ({ page }) => {
  const email = `e2e-shell-${Date.now()}@example.test`;
  const signup = await page.request.post("/api/auth/sign-up/email", { data: { name: "Shell User", email, password } });
  expect(signup.ok(), await signup.text()).toBeTruthy();

  await page.goto("/pl");
  await page.locator("#onboarding-name").fill("Shell Household");
  await page.locator("#onboarding-person").fill("Shell User");
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/households") && response.request().method() === "POST" && response.status() === 201),
    page.locator("form").filter({ has: page.locator("#onboarding-name") }).getByRole("button").click(),
  ]);
  await page.reload();

  await expect(page.locator('header[role="banner"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Główna nawigacja" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Otwórz ustawienia" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Otwórz menu konta użytkownika/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Wybór języka" })).toHaveCount(0);

  await page.getByRole("button", { name: /Otwórz menu konta użytkownika/ }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByTestId("sign-out-button")).toBeVisible();
  await page.screenshot({ path: "test-results/shell-polish-pl-desktop.png", fullPage: true });

  await page.getByRole("button", { name: /Otwórz menu konta użytkownika/ }).click();
  await page.getByRole("link", { name: "Otwórz ustawienia" }).click();
  await expect(page).toHaveURL(/\/pl\/settings$/);
  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
  await page.getByRole("button", { name: "Przełącz na język angielski" }).click();
  await expect(page).toHaveURL(/\/en\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");
  await expect(page.locator('header[role="banner"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Accounts" }).focus();
  await expect(page.getByRole("link", { name: "Accounts" })).toBeFocused();
  await page.screenshot({ path: "test-results/shell-polish-en-mobile.png", fullPage: true });
});
