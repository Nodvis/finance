import { expect, test } from "@playwright/test";

const password = "LocalOnly-E2E-Password-123!";

test("PL and EN review and confirm an observed recurring pattern", async ({ page }) => {
  const email = `e2e-recurring-${Date.now()}@example.test`;
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Recurring household", email, password },
  });
  expect(signup.ok(), await signup.text()).toBeTruthy();
  await page.goto("/pl");
  await page.locator("#onboarding-name").fill("Recurring Household");
  await page.locator("#onboarding-person").fill("Recurring Person");
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/households") && response.request().method() === "POST" && response.status() === 201),
    page.locator("form").filter({ has: page.locator("#onboarding-name") }).getByRole("button").click(),
  ]);
  await page.reload();
  const current = await page.request.get("/api/households/current");
  expect(current.ok(), await current.text()).toBeTruthy();
  const household = (await current.json()).data as { householdId: string; personId: string };
  const accountResponse = await page.request.post(`/api/households/${household.householdId}/accounts`, {
    data: { name: "Recurring checking", type: "checking", currency: "PLN", ownerPersonIds: [household.personId], initialBalance: { amountNatural: "1000", capturedAt: new Date().toISOString() } },
  });
  expect(accountResponse.ok(), await accountResponse.text()).toBeTruthy();
  const account = (await accountResponse.json()).data as { id: string };
  for (const occurredOn of ["2026-01-05T00:00:00.000Z", "2026-02-05T00:00:00.000Z", "2026-03-06T00:00:00.000Z"]) {
    const transaction = await page.request.post(`/api/households/${household.householdId}/transactions`, {
      data: { kind: "expense", accountId: account.id, amount: { amountMinor: "4999", currency: "PLN" }, payee: "Stream Co", paidByPersonId: household.personId, occurredOn },
    });
    expect(transaction.ok(), await transaction.text()).toBeTruthy();
  }

  await page.goto("/pl/recurring");
  await expect(page.getByRole("heading", { name: "Powtarzalne płatności i wpływy" })).toBeVisible();
  await expect(page.getByText("Stream Co", { exact: true })).toBeVisible();
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith(`/api/households/${household.householdId}/recurring`) && response.request().method() === "PATCH" && response.status() === 200),
    page.getByRole("button", { name: "Potwierdź wzorzec" }).click(),
  ]);
  await expect(page.getByRole("status")).toHaveText("Potwierdzone");

  await page.goto("/en/recurring");
  await expect(page.getByRole("heading", { name: "Recurring payments and income" })).toBeVisible();
  await expect(page.getByText("Stream Co", { exact: true })).toBeVisible();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
});
