import { expect, test } from "@playwright/test";

const password = "LocalOnly-E2E-Password-123!";

test("PL and EN show data-backed analytics without combining currencies", async ({ page }) => {
  const email = `analytics-${Date.now()}@example.test`;
  const signup = await page.request.post("/api/auth/sign-up/email", { data: { name: "Analytics household", email, password } });
  expect(signup.ok(), await signup.text()).toBeTruthy();
  await page.goto("/pl");
  await page.locator("#onboarding-name").fill("Analytics household");
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/households") && r.request().method() === "POST" && r.status() === 201),
    page.locator("form").filter({ has: page.locator("#onboarding-name") }).getByRole("button").click(),
  ]);
  await page.reload();
  const current = await page.request.get("/api/households/current");
  const household = (await current.json()).data as { householdId: string; personId: string };
  const categoryResponse = await page.request.post(`/api/households/${household.householdId}/categories`, { data: { name: "Housing", applicability: "expense" } });
  const category = (await categoryResponse.json()).data as { id: string };
  const accountResponse = await page.request.post(`/api/households/${household.householdId}/accounts`, { data: { name: "Analytics checking", type: "checking", currency: "PLN", ownerPersonIds: [household.personId], initialBalance: { amountNatural: "1000", capturedAt: new Date().toISOString() } } });
  const account = (await accountResponse.json()).data as { id: string };
  const eurAccountResponse = await page.request.post(`/api/households/${household.householdId}/accounts`, { data: { name: "Analytics euro", type: "checking", currency: "EUR", ownerPersonIds: [household.personId], initialBalance: { amountNatural: "1000", capturedAt: new Date().toISOString() } } });
  const eurAccount = (await eurAccountResponse.json()).data as { id: string };
  for (const item of [
    { amountMinor: "12000", currency: "PLN", occurredOn: "2026-01-05T12:00:00.000Z" },
    { amountMinor: "8000", currency: "PLN", occurredOn: "2026-02-05T12:00:00.000Z" },
    { amountMinor: "5000", currency: "EUR", occurredOn: "2026-02-05T12:00:00.000Z" },
  ]) {
    const response = await page.request.post(`/api/households/${household.householdId}/transactions`, { data: { kind: "expense", amountMinor: item.amountMinor, currency: item.currency, occurredOn: item.occurredOn, accountId: item.currency === "EUR" ? eurAccount.id : account.id, categoryId: category.id, payee: "Home Ltd", paidByPersonId: household.personId, submissionId: crypto.randomUUID() } });
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  await page.goto("/pl/analytics");
  await expect(page.getByRole("heading", { name: "Analiza gospodarstwa" })).toBeVisible();
  await expect(page.getByText("PLN", { exact: true })).toBeVisible();
  await expect(page.getByText("EUR", { exact: true })).toBeVisible();
  await expect(page.getByText("Housing", { exact: true }).first()).toBeVisible();
  await page.goto("/en/analytics");
  await expect(page.getByRole("heading", { name: "Household analytics" })).toBeVisible();
  await expect(page.getByText("PLN", { exact: true })).toBeVisible();
  await expect(page.getByText("EUR", { exact: true })).toBeVisible();
});
