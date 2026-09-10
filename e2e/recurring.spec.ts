import { expect, test } from "@playwright/test";

const password = "LocalOnly-E2E-Password-123!";

test("PL and EN review and confirm an observed recurring pattern", async ({ page }) => {
  const email = `e2e-recurring-${Date.now()}@example.test`;
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Recurring household", email, password },
  });
  expect(signup.ok(), await signup.text()).toBeTruthy();
  await page.goto("/pl");
  const householdResponse = await page.request.post("/api/households", {
    data: { name: "Recurring Household", defaultCurrency: "PLN", personDisplayName: "Recurring Person" },
  });
  expect(householdResponse.ok(), await householdResponse.text()).toBeTruthy();
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
  const patternsResponse = await page.request.get(`/api/households/${household.householdId}/recurring`);
  expect(patternsResponse.ok(), await patternsResponse.text()).toBeTruthy();
  const pattern = (await patternsResponse.json()).data.find((item: { counterparty: string }) => item.counterparty === "Stream Co") as { key: string };
  const confirmation = await page.request.patch(`/api/households/${household.householdId}/recurring`, { data: { patternKey: pattern.key, status: "confirmed" } });
  expect(confirmation.ok(), await confirmation.text()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Potwierdzone");

  await page.goto("/en/recurring");
  await expect(page.getByRole("heading", { name: "Recurring payments and income" })).toBeVisible();
  await expect(page.getByText("Stream Co", { exact: true })).toBeVisible();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  const recurring = await page.request.post(`/api/households/${household.householdId}/recurring-obligations`, { data: { title: "Internet monthly", amountNatural: "89.99", currency: "PLN", frequency: "monthly", firstDueDate: "2026-09-15" } });
  expect(recurring.status(), await recurring.text()).toBe(201);
  const recurringData = (await recurring.json()).data as { id: string; version: number };
  await page.goto("/pl/recurring");
  await expect(page.getByText("Internet monthly", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Internet monthly", { exact: true })).toBeVisible();
  await page.goto("/en/recurring");
  await expect(page.getByText("Internet monthly", { exact: true })).toBeVisible();
  const obligationsResponse = await page.request.get(`/api/households/${household.householdId}/obligations?status=active&today=2026-09-10`);
  expect(obligationsResponse.ok(), await obligationsResponse.text()).toBeTruthy();
  const obligations = (await obligationsResponse.json()).data as Array<{ id: string; dueDate: string; version: number; recurringScheduledDate?: string; recurringOverride?: boolean }>;
  const september = obligations.find((item) => item.recurringScheduledDate === "2026-09-15");
  expect(september).toBeTruthy();
  const overridden = await page.request.patch(`/api/households/${household.householdId}/obligations/${september!.id}`, { data: { version: september!.version, amountNatural: "220", dueDate: "2026-09-20" } });
  expect(overridden.ok(), await overridden.text()).toBeTruthy();
  const overriddenData = (await overridden.json()).data as { dueDate: string; amountMinor: string; recurringScheduledDate?: string; recurringOverride?: boolean };
  expect(overriddenData).toMatchObject({ dueDate: "2026-09-20", amountMinor: "22000", recurringScheduledDate: "2026-09-15", recurringOverride: true });
  const seriesEdited = await page.request.patch(`/api/households/${household.householdId}/recurring-obligations/${recurringData.id}`, { data: { version: recurringData.version, amountNatural: "99" } });
  expect(seriesEdited.ok(), await seriesEdited.text()).toBeTruthy();
  const afterSeriesEdit = await page.request.get(`/api/households/${household.householdId}/obligations?status=active&today=2026-09-10`);
  const afterSeriesData = (await afterSeriesEdit.json()).data as Array<{ id: string; version: number; dueDate: string; amountMinor: string; recurringScheduledDate?: string; recurringOverride?: boolean }>;
  expect(afterSeriesData).toContainEqual(expect.objectContaining({ dueDate: "2026-09-20", amountMinor: "22000", recurringScheduledDate: "2026-09-15", recurringOverride: true }));
  expect(afterSeriesData).toContainEqual(expect.objectContaining({ dueDate: "2026-11-15", amountMinor: "9900", recurringScheduledDate: "2026-11-15", recurringOverride: false }));
  const october = afterSeriesData.find((item) => item.recurringScheduledDate === "2026-10-15");
  expect(october).toBeTruthy();
  const skipped = await page.request.post(`/api/households/${household.householdId}/obligations/${october!.id}/cancel`, { data: { version: october!.version } });
  expect(skipped.ok(), await skipped.text()).toBeTruthy();
  const activeAfter = await page.request.get(`/api/households/${household.householdId}/obligations?status=active&today=2026-09-10`);
  const activeData = (await activeAfter.json()).data as Array<{ id: string; dueDate: string }>;
  expect(activeData.some((item) => item.id === october!.id)).toBe(false);
  await page.reload();
  await expect(page.getByText("Internet monthly", { exact: true })).toBeVisible();
  await page.goto("/en/forecast");
  await expect(page.getByRole("heading", { name: "Cash forecast" })).toBeVisible();
  await expect(page.getByText("7 days", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "30 days" }).click();
  await expect(page).toHaveURL(/\/en\/forecast\?horizon=30$/);
});
