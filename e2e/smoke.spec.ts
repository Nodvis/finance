import { expect, test } from "@playwright/test";

test("renders the Polish finance summary", async ({ page }) => {
  await page.goto("/pl");

  await expect(
    page.getByRole("heading", {
      name: "Twoja sytuacja finansowa bez księgowego chaosu.",
    }),
  ).toBeVisible();

  await expect(page.getByText("Dostępne teraz")).toBeVisible();
  await expect(page.getByText("Do zapłaty")).toBeVisible();
  await expect(page.getByText("Zadłużenie")).toBeVisible();
});

test("renders the English finance summary", async ({ page }) => {
  await page.goto("/en");

  await expect(
    page.getByRole("heading", {
      name: "Your financial situation without the accounting clutter.",
    }),
  ).toBeVisible();

  await expect(page.getByText("Available now")).toBeVisible();
  await expect(page.getByText("Upcoming")).toBeVisible();
  await expect(page.getByText("Debt")).toBeVisible();
});
