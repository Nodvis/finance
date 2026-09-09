import { expect, test } from "@playwright/test";

const password = "LocalOnly-E2E-Password-123!";

test("PL and EN create and toggle an explainable categorization rule", async ({ page }) => {
  const email = `e2e-rule-${Date.now()}@example.test`;
  const signup = await page.request.post("/api/auth/sign-up/email", { data: { name: "Rule household", email, password } });
  expect(signup.ok(), await signup.text()).toBeTruthy();
  await page.goto("/pl");
  await page.locator("#onboarding-name").fill("Rule Household");
  await page.locator("#onboarding-person").fill("Rule Person");
  await page.locator("form").filter({ has: page.locator("#onboarding-name") }).getByRole("button").click();
  const current = await page.request.get("/api/households/current");
  expect(current.ok()).toBeTruthy();
  const household = (await current.json()).data as { householdId: string };
  const categoryResponse = await page.request.post(`/api/households/${household.householdId}/categories`, { data: { name: "Groceries", applicability: "expense" } });
  expect(categoryResponse.ok(), await categoryResponse.text()).toBeTruthy();
  const category = (await categoryResponse.json()).data as { id: string };

  await page.goto("/pl/rules");
  await page.getByLabel("Nazwa reguły").fill("Grocery rule");
  await page.getByLabel(/Nazwa kontrahenta/).fill("Acme Market");
  await page.getByLabel("Kategoria").selectOption(category.id);
  await page.getByRole("button", { name: "Zapisz regułę" }).click();
  await expect(page.getByText("Grocery rule", { exact: true })).toBeVisible();

  await page.goto("/en/rules");
  await expect(page.getByRole("heading", { name: "Categorization rules" })).toBeVisible();
  await expect(page.getByText("Grocery rule", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Disable" }).click();
  await expect(page.getByText("Disabled")).toBeVisible();

  const rules = await page.request.get(`/api/households/${household.householdId}/categorization-rules`);
  expect(rules.ok()).toBeTruthy();
  const rule = (await rules.json()).data[0] as { enabled: boolean; matchText: string };
  expect(rule.enabled).toBe(false);
  expect(rule.matchText).toBe("Acme Market");
});
