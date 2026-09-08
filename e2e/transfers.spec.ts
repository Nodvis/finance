import { expect, test, type Page } from "@playwright/test";

const password = "LocalOnly-E2E-Password-123!";

type Household = { householdId: string; personId: string };
type Account = { id: string; name: string };

async function createUserAndHousehold(
  page: Page,
  locale: "pl" | "en",
): Promise<Household> {
  const email = `e2e-transfers-${locale}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const signUp = await page.request.post("/api/auth/sign-up/email", {
    data: { name: `E2E Transfers ${locale}`, email, password },
  });
  expect(
    signUp.ok(),
    `signup ${signUp.status()} ${await signUp.text()}`,
  ).toBeTruthy();

  await page.goto(`/${locale}`);
  await page.locator("#onboarding-name").fill(`E2E Household ${locale}`);
  await page.locator("#onboarding-person").fill(`E2E Person ${locale}`);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/households") &&
        response.request().method() === "POST",
    ),
    page
      .locator("form")
      .filter({ has: page.locator("#onboarding-name") })
      .getByRole("button")
      .click(),
  ]);
  await expect(page.getByRole("heading").first()).toBeVisible();

  const current = await page.request.get("/api/households/current");
  expect(
    current.ok(),
    `current ${current.status()} ${await current.text()}`,
  ).toBeTruthy();
  const body = (await current.json()).data as Household;
  return body;
}

test.describe("Account identifiers & safe transfer matching", () => {
  test.setTimeout(120_000);

  test("manages account identifiers and executes safe internal transfer reconciliation", async ({
    page,
  }) => {
    const household = await createUserAndHousehold(page, "pl");

    // 1. Create two accounts: Source Checking & Destination Savings
    const createAcc = async (name: string) => {
      const res = await page.request.post(
        `/api/households/${household.householdId}/accounts`,
        {
          data: {
            name,
            type: "checking",
            currency: "PLN",
            ownerPersonIds: [household.personId],
            initialBalance: {
              amountNatural: "2000",
              capturedAt: new Date().toISOString(),
            },
          },
        },
      );
      expect(res.ok()).toBeTruthy();
      return (await res.json()).data as Account;
    };

    const checking = await createAcc("Konto Główne");
    const savings = await createAcc("Konto Oszczędnościowe");

    // 2. Add an identifier via API (valid Polish NRB/IBAN)
    // 74 1090 2402 0000 0001 2345 6789
    const validIban = "PL74109024020000000123456789";
    const addIdenRes = await page.request.post(
      `/api/households/${household.householdId}/accounts/${savings.id}/identifiers`,
      {
        data: {
          rawIdentifier: validIban,
          label: "Numer konta oszczędnościowego",
        },
      },
    );
    expect(
      addIdenRes.ok(),
      `add iden ${addIdenRes.status()} ${await addIdenRes.text()}`,
    ).toBeTruthy();

    // 3. Go to Accounts page and verify masked identifier is displayed
    await page.goto("/pl/accounts");
    await expect(page.getByText("Konto Oszczędnościowe")).toBeVisible();
    await expect(
      page.getByText("PL74 •••• •••• •••• •••• •••• 6789"),
    ).toBeVisible();
    // Verify unmasked raw identifier is NOT visible on the card
    await expect(page.getByText("PL74109024020000000123456789")).toHaveCount(0);

    // 4. Inject a pair of transfer candidate transactions
    // Outflow from Checking referencing the registered identifier
    const outflowRes = await page.request.post(
      `/api/households/${household.householdId}/transactions`,
      {
        data: {
          kind: "expense",
          accountId: checking.id,
          amountMinor: "35000", // 350.00 PLN
          currency: "PLN",
          payee: "Przelew własny na konto PL74109024020000000123456789",
          occurredOn: new Date().toISOString(),
          submissionId: `e2e-transfer-outflow-${Date.now()}`,
        },
      },
    );
    expect(outflowRes.ok()).toBeTruthy();

    // Inflow to Savings
    const inflowRes = await page.request.post(
      `/api/households/${household.householdId}/transactions`,
      {
        data: {
          kind: "income",
          accountId: savings.id,
          amountMinor: "35000", // 350.00 PLN
          currency: "PLN",
          source: "Zasilenie konta oszczędnościowego",
          occurredOn: new Date().toISOString(),
          submissionId: `e2e-transfer-inflow-${Date.now()}`,
        },
      },
    );
    expect(inflowRes.ok()).toBeTruthy();

    // 5. Navigate to Transfers page via Navigation link
    await page.getByRole("link", { name: "Przelewy" }).click();
    await expect(page).toHaveURL(/\/pl\/transfers/);

    // 6. Candidate should appear under "Gotowe do połączenia"
    await expect(page.getByText("Konto Główne")).toBeVisible();
    await expect(page.getByText("Konto Oszczędnościowe")).toBeVisible();
    await expect(
      page.getByText("PL74 •••• •••• •••• •••• •••• 6789"),
    ).toBeVisible();

    // 7. Click Match transfer
    await page.getByRole("button", { name: "Połącz przelew" }).click();

    // 8. Wait for success notification
    await expect(
      page.getByText("Przelew został pomyślnie połączony"),
    ).toBeVisible();

    // 9. Switch to Reconciled history tab and verify entry
    await page.getByRole("tab", { name: /Historia uzgodnień/ }).click();
    await expect(
      page.getByText("PL74 •••• •••• •••• •••• •••• 6789"),
    ).toBeVisible();
  });
});
