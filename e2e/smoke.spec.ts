import { expect, test } from "@playwright/test";

test("renders the Polish finance summary", async ({ page }) => {
  await page.goto("/pl");

  await expect(
    page.getByRole("heading", {
      name: "Twoja sytuacja finansowa bez księgowego chaosu.",
    }),
  ).toBeVisible();

  await expect(page.getByText("Dostępne teraz", { exact: true })).toBeVisible();
  await expect(page.getByText("Do zapłaty", { exact: true })).toBeVisible();
  await expect(page.getByText("Zadłużenie", { exact: true })).toBeVisible();
});

test("renders the English finance summary", async ({ page }) => {
  await page.goto("/en");

  await expect(
    page.getByRole("heading", {
      name: "Your financial situation without the accounting clutter.",
    }),
  ).toBeVisible();

  await expect(page.getByText("Available now", { exact: true })).toBeVisible();
  await expect(page.getByText("Upcoming", { exact: true })).toBeVisible();
  await expect(page.getByText("Debt", { exact: true })).toBeVisible();
});
