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

test("provides a visible accessible language switcher that switches locales and sets NEXT_LOCALE cookie", async ({
  page,
}) => {
  await page.goto("/pl");

  // Language switcher is visible with accessible navigation
  const langNav = page.getByRole("navigation", { name: "Wybierz język" });
  await expect(langNav).toBeVisible();

  // Active locale is PL
  const plButton = page.getByRole("button", { name: "Przełącz na język polski" });
  await expect(plButton).toHaveAttribute("aria-current", "page");

  // Click English button
  const enButton = page.getByRole("button", { name: "Przełącz na język angielski" });
  await enButton.click();

  // URL updates to /en
  await expect(page).toHaveURL(/\/en/);

  // Content is now in English
  await expect(
    page.getByRole("heading", {
      name: "Your financial situation without the accounting clutter.",
    }),
  ).toBeVisible();

  // NEXT_LOCALE cookie is persisted
  const cookies = await page.context().cookies();
  const nextLocaleCookie = cookies.find((c) => c.name === "NEXT_LOCALE");
  expect(nextLocaleCookie).toBeDefined();
  expect(nextLocaleCookie?.value).toBe("en");

  // Switch back to Polish
  const switchToPl = page.getByRole("button", { name: "Switch to Polish" });
  await switchToPl.click();
  await expect(page).toHaveURL(/\/pl/);
  await expect(
    page.getByRole("heading", {
      name: "Twoja sytuacja finansowa bez księgowego chaosu.",
    }),
  ).toBeVisible();
});
