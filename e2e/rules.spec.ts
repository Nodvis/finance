import { expect, test } from "@playwright/test";

const password = "LocalOnly-E2E-Password-123!";

test("PL and EN create and toggle an explainable categorization rule", async ({ page }) => {
  const email = `e2e-rule-${Date.now()}@example.test`;
  const signup = await page.request.post("/api/auth/sign-up/email", { data: { name: "Rule household", email, password } });
  expect(signup.ok(), await signup.text()).toBeTruthy();
  await page.goto("/pl");
  await page.locator("#onboarding-name").fill("Rule Household");
  await page.locator("#onboarding-person").fill("Rule Person");
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/households") && response.request().method() === "POST" && response.status() === 201),
    page.locator("form").filter({ has: page.locator("#onboarding-name") }).getByRole("button").click(),
  ]);
  await page.reload();
  const current = await page.request.get("/api/households/current");
  expect(current.ok(), await current.text()).toBeTruthy();
  const household = (await current.json()).data as { householdId: string; personId: string };
  const categoryResponse = await page.request.post(`/api/households/${household.householdId}/categories`, { data: { name: "Groceries", applicability: "expense" } });
  expect(categoryResponse.ok(), await categoryResponse.text()).toBeTruthy();
  const category = (await categoryResponse.json()).data as { id: string };
  const accountResponse = await page.request.post(`/api/households/${household.householdId}/accounts`, { data: { name: "Rule checking", type: "checking", currency: "PLN", ownerPersonIds: [household.personId], initialBalance: { amountNatural: "1000", capturedAt: new Date().toISOString() } } });
  expect(accountResponse.ok(), await accountResponse.text()).toBeTruthy();
  const account = (await accountResponse.json()).data as { id: string };
  const transactionResponse = await page.request.post(`/api/households/${household.householdId}/transactions`, { data: { kind: "expense", accountId: account.id, amount: { amountMinor: "1234", currency: "PLN" }, payee: "Acme Market", paidByPersonId: household.personId, occurredOn: "2026-03-10T00:00:00.000Z" } });
  expect(transactionResponse.ok(), await transactionResponse.text()).toBeTruthy();
  const learnedTransactionResponse = await page.request.post(`/api/households/${household.householdId}/transactions`, { data: { kind: "expense", accountId: account.id, amount: { amountMinor: "899", currency: "PLN" }, payee: "Bakery House", paidByPersonId: household.personId, occurredOn: "2026-03-11T00:00:00.000Z" } });
  expect(learnedTransactionResponse.ok(), await learnedTransactionResponse.text()).toBeTruthy();

  await page.goto("/pl/rules");
  await page.getByLabel("Kategoria dla Bakery House").selectOption(category.id);
  await page.getByLabel("Kategoria dla Bakery House").locator("..") .getByRole("button", { name: "Użyj dla podobnych" }).click();
  await expect(page.getByText(/Zapisano regułę dla tego kontrahenta/)).toBeVisible();
  await page.getByLabel("Nazwa reguły").fill("Grocery rule");
  await page.getByLabel(/Nazwa kontrahenta/).fill("Acme Market");
  await page.locator("form").getByLabel("Kategoria").selectOption(category.id);
  await page.getByRole("button", { name: "Zapisz regułę" }).click();
  await expect(page.getByText("Grocery rule", { exact: true })).toBeVisible();
  for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
  await page.getByRole("button", { name: "Podejrzyj zmiany" }).click();
  await expect(page.getByText(/Matched Grocery rule/)).toBeVisible();
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/categorization-rules/apply") && response.request().method() === "POST" && response.status() === 200),
    page.getByRole("button", { name: "Zastosuj sprawdzone zmiany" }).click(),
  ]);
  await page.reload();
  await expect(page.getByText("Nie ma nieskategoryzowanych transakcji do przejrzenia.")).toBeVisible();

  await page.goto("/en/rules");
  await expect(page.getByRole("heading", { name: "Categorization rules" })).toBeVisible();
  await expect(page.getByText("Grocery rule", { exact: true })).toBeVisible();
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/categorization-rules/") && response.request().method() === "PATCH" && response.status() === 200),
    page.getByRole("article").filter({ hasText: "Grocery rule" }).getByRole("button", { name: "Disable" }).click(),
  ]);
  await expect(page.getByText("Disabled")).toBeVisible();

  const rules = await page.request.get(`/api/households/${household.householdId}/categorization-rules`);
  expect(rules.ok()).toBeTruthy();
  const rule = (await rules.json()).data.find((item: { matchText: string }) => item.matchText === "Acme Market") as { enabled: boolean; matchText: string };
  expect(rule.enabled).toBe(false);
  expect(rule.matchText).toBe("Acme Market");
  const transactions = await page.request.get(`/api/households/${household.householdId}/transactions?status=all`);
  expect(transactions.ok()).toBeTruthy();
  const transaction = (await transactions.json()).data.find((item: { payee?: string }) => item.payee === "Acme Market") as { categoryId: string | null };
  expect(transaction.categoryId).toBe(category.id);
});
