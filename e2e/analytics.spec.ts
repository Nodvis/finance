import { expect, test } from "@playwright/test";

const password = "LocalOnly-E2E-Password-123!";

test("PL and EN show data-backed analytics without combining currencies", async ({ page }) => {
  const email = `analytics-${Date.now()}@example.test`;
  await page.goto("/pl/auth/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/pl/);
  await page.locator("#onboarding-name").fill("Analytics household");
  await page.locator("form").filter({ has: page.locator("#onboarding-name") }).getByRole("button").click();
  await page.waitForResponse((r) => r.url().endsWith("/api/households/current") && r.status() === 200);
  const current = await page.request.get("/api/households/current");
  const household = (await current.json()).data as { householdId: string; personId: string };
  const accounts = await page.request.get(`/api/households/${household.householdId}/accounts`);
  const account = (await accounts.json()).data[0] as { id: string };
  const categoryResponse = await page.request.post(`/api/households/${household.householdId}/categories`, { data: { name: "Housing", kind: "expense" } });
  const category = (await categoryResponse.json()).data as { id: string };
  for (const item of [
    { amountMinor: "12000", currency: "PLN", occurredOn: "2026-01-05T12:00:00.000Z" },
    { amountMinor: "8000", currency: "PLN", occurredOn: "2026-02-05T12:00:00.000Z" },
    { amountMinor: "5000", currency: "EUR", occurredOn: "2026-02-05T12:00:00.000Z" },
  ]) {
    await page.request.post(`/api/households/${household.householdId}/transactions`, { data: { kind: "expense", amountMinor: item.amountMinor, currency: item.currency, occurredOn: item.occurredOn, accountId: account.id, categoryId: category.id, payee: "Home Ltd", paidByPersonId: household.personId, submissionId: crypto.randomUUID() } });
  }
  await page.goto("/pl/analytics");
  await expect(page.getByRole("heading", { name: "Analiza gospodarstwa" })).toBeVisible();
  await expect(page.getByText("PLN", { exact: true })).toBeVisible();
  await expect(page.getByText("EUR", { exact: true })).toBeVisible();
  await expect(page.getByText("Housing", { exact: true })).toBeVisible();
  await page.goto("/en/analytics");
  await expect(page.getByRole("heading", { name: "Household analytics" })).toBeVisible();
  await expect(page.getByText("PLN", { exact: true })).toBeVisible();
  await expect(page.getByText("EUR", { exact: true })).toBeVisible();
});
