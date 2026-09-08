import { expect, test } from "@playwright/test";

test("renders the Polish application shell", async ({ page }) => {
  await page.goto("/pl");
  await expect(page.locator('header[role="banner"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Główna nawigacja" })).toBeVisible();
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Konta" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kategorie" })).toBeVisible();
});

test("renders the English application shell", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator('header[role="banner"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Accounts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Categories" })).toBeVisible();
});

test("switches between Polish and English", async ({ page }) => {
  await page.goto("/pl");
  await expect(page.getByRole("region", { name: "Wybór języka interfejsu" })).toBeVisible();
  await page.getByRole("button", { name: "Przełącz na język angielski" }).click();
  await expect(page).toHaveURL(/\/en/);
  await expect(page.getByRole("region", { name: "Interface language selection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to Polish" })).toBeVisible();
});
