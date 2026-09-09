import { expect, test } from "@playwright/test";

const password = "LocalOnly-E2E-Password-123!";

test.describe("overdraft management", () => {
  test("creates, reads, edits and archives overdraft in Polish desktop flow", async ({ page }) => {
    const email = `e2e-overdraft-pl-${Date.now()}@example.test`;
    const signup = await page.request.post("/api/auth/sign-up/email", { data: { name: "Overdraft User", email, password } });
    expect(signup.ok(), await signup.text()).toBeTruthy();

    await page.goto("/pl");
    await page.locator("#onboarding-name").fill("Overdraft Household");
    await page.locator("#onboarding-person").fill("Overdraft User");
    await Promise.all([
      page.waitForResponse((response) => response.url().endsWith("/api/households") && response.request().method() === "POST" && response.status() === 201),
      page.locator("form").filter({ has: page.locator("#onboarding-name") }).getByRole("button").click(),
    ]);
    await page.goto("/pl/accounts");

    await page.getByRole("button", { name: "+ Dodaj konto" }).first().click();
    await page.getByLabel("Nazwa konta").fill("Konto główne");
    await page.getByLabel("Saldo początkowe (opcjonalnie)").fill("3000");
    await page.getByLabel(/To konto bieżące ma uzgodniony debet/).check();
    await page.getByLabel("Uzgodniony limit debetu").fill("2000");
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/households/") && response.url().endsWith("/accounts") && response.request().method() === "POST" && response.status() === 201),
      page.getByRole("button", { name: "Utwórz konto" }).click(),
    ]);

    const accountCard = page.locator("article").filter({ hasText: "Konto główne" });
    await expect(accountCard).toContainText("Własne środki");
    await expect(accountCard).toContainText("3000,00 zł");
    await expect(accountCard).toContainText("Dostępny debet");
    await expect(accountCard).toContainText("5000,00 zł");
    await page.reload();
    await expect(page.getByText("Konto główne")).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "Konto główne" })).toContainText("2000,00 zł");

    await page.getByRole("button", { name: "Edytuj debet" }).click();
    await page.getByLabel("Limit debetu").fill("2500");
    await page.getByLabel("Wykorzystany debet").fill("500");
    await page.getByLabel("Dostępny debet").fill("2000");
    await page.getByLabel("Data obserwacji").fill("2026-09-09");
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/credit-facility") && response.request().method() === "PATCH" && response.status() === 200),
      page.getByRole("button", { name: "Zapisz debet" }).click(),
    ]);
    await expect(page.getByText("Dane debetu zostały zaktualizowane.")).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "Konto główne" })).toContainText("2500,00 zł");

    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Zarchiwizuj debet" }).click();
    await expect(page.getByText("Debet został zarchiwizowany.")).toBeVisible();
  });

  test("renders the same management path in English on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const email = `e2e-overdraft-en-${Date.now()}@example.test`;
    const signup = await page.request.post("/api/auth/sign-up/email", { data: { name: "Overdraft User", email, password } });
    expect(signup.ok(), await signup.text()).toBeTruthy();
    await page.goto("/en");
    await page.locator("#onboarding-name").fill("Overdraft Household");
    await page.locator("#onboarding-person").fill("Overdraft User");
    await Promise.all([
      page.waitForResponse((response) => response.url().endsWith("/api/households") && response.request().method() === "POST" && response.status() === 201),
      page.locator("form").filter({ has: page.locator("#onboarding-name") }).getByRole("button").click(),
    ]);
    await page.goto("/en/accounts");
    await expect(page.getByRole("heading", { name: "Accounts & balances" })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  });
});
