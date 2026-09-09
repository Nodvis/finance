import { expect, test, type Page } from "@playwright/test";

const password = "LocalOnly-E2E-Password-123!";

test.describe("liabilities workspace", () => {
  test.setTimeout(120_000);
  test.describe.configure({ mode: "serial" });

  for (const locale of ["pl", "en"] as const) {
    test(`${locale} creates and records a liability repayment`, async ({ page }) => {
      const email = `e2e-liability-${locale}-${Date.now()}@example.test`;
      const signup = await page.request.post("/api/auth/sign-up/email", {
        data: { name: `Liability ${locale}`, email, password },
      });
      expect(signup.ok(), await signup.text()).toBeTruthy();

      await page.goto(`/${locale}`);
      await page.locator("#onboarding-name").fill(`Liability Household ${locale}`);
      await page.locator("#onboarding-person").fill(`Liability Person ${locale}`);
      await Promise.all([
        page.waitForResponse((response) => response.url().includes("/api/households") && response.request().method() === "POST"),
        page.locator("form").filter({ has: page.locator("#onboarding-name") }).getByRole("button").click(),
      ]);
      const current = await page.request.get("/api/households/current");
      expect(current.ok()).toBeTruthy();
      const household = (await current.json()).data as { householdId: string; personId: string };

      const createAccount = async (name: string) => {
        const response = await page.request.post(`/api/households/${household.householdId}/accounts`, {
          data: {
            name,
            type: "checking",
            currency: "PLN",
            ownerPersonIds: [household.personId],
            initialBalance: { amountNatural: "5000", capturedAt: new Date().toISOString() },
          },
        });
        expect(response.ok(), await response.text()).toBeTruthy();
        return (await response.json()).data as { id: string };
      };
      const sourceAccount = await createAccount(`Repayment source ${locale}`);
      const destinationAccount = await createAccount(`Repayment destination ${locale}`);

      await page.goto(`/${locale}/liabilities`);
      await page.getByRole("button", { name: locale === "pl" ? "Dodaj zobowiązanie" : "Add liability" }).click();
      await page.getByLabel(locale === "pl" ? "Nazwa" : "Name").fill(`Loan ${locale}`);
      await page.getByLabel(locale === "pl" ? "Waluta" : "Currency").fill("PLN");
      await page.getByLabel(locale === "pl" ? /Konto docelowe spłaty/ : /Repayment destination/).selectOption(destinationAccount.id);
      await page.getByLabel(locale === "pl" ? /Aktualne saldo zadłużenia/ : /Observed outstanding/).fill("1234.56");
      await page.locator('input[type="date"]').waitFor({ state: "visible" });
      await page.locator('input[type="date"]').fill("2026-09-09");
      await page.getByRole("button", { name: locale === "pl" ? "Utwórz zobowiązanie" : "Create liability" }).click();
      await expect(page.getByText(`Loan ${locale}`, { exact: true })).toBeVisible();
      await page.getByRole("link", { name: locale === "pl" ? "Szczegóły" : "Details" }).click();
      await expect(page.getByText(/1,234|1 234|1234/)).toBeVisible();

      await page.getByRole("button", { name: locale === "pl" ? "Zapisz spłatę" : "Save repayment" }).click();
      await page.getByLabel(locale === "pl" ? "Data spłaty" : "Repayment date").fill("2026-09-09");
      await page.getByLabel(locale === "pl" ? /Łączna kwota spłaty/ : /Total repayment amount/).fill("100.00");
      await page.getByLabel(locale === "pl" ? /Zapłać z konta/ : /Pay from account/).selectOption(sourceAccount.id);
      await page.getByLabel(locale === "pl" ? /Spłata kapitału/ : /Principal reduction/).fill("80.00");
      await page.getByLabel(locale === "pl" ? /Odsetki \/ Koszt/ : /Interest \/ Financing cost/).fill("10.00");
      await page.getByLabel(locale === "pl" ? /Prowizje \/ Opłaty/ : /Fee \/ Commission/).fill("10.00");
      await page.getByRole("button", { name: locale === "pl" ? "Zapisz spłatę" : "Save repayment" }).click();
      await expect(page.getByText(/100|100,00|100\.00/)).toBeVisible();

      const repayments = await page.request.get(`/api/households/${household.householdId}/liabilities/${(await page.url()).split("/").pop()}/repayments`);
      expect(repayments.ok()).toBeTruthy();
      const data = (await repayments.json()).data as Array<{ amountMinor: string; principalMinor: string | null }>;
      expect(data[0]?.amountMinor).toBe("10000");
      expect(data[0]?.principalMinor).toBe("8000");
    });
  }
});
