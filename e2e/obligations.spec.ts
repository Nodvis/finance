import { expect, test } from "@playwright/test";

const password = "LocalOnly-E2E-Password-123!";

test.describe("obligations vertical slice", () => {
  test.setTimeout(120_000);
  test.describe.configure({ mode: "serial" });

  for (const locale of ["pl", "en"] as const) {
    test(`${locale} creates, manages, and matches an obligation with expense`, async ({
      page,
    }) => {
      // 1. Sign up new user
      const email = `e2e-obligation-${locale}-${Date.now()}@example.test`;
      const signup = await page.request.post("/api/auth/sign-up/email", {
        data: { name: `Obligation ${locale}`, email, password },
      });
      expect(signup.ok(), await signup.text()).toBeTruthy();

      // 2. Complete household onboarding
      await page.goto(`/${locale}`);
      await page.locator("#onboarding-name").fill(`Obligation Household ${locale}`);
      await page.locator("#onboarding-person").fill(`Obligation Person ${locale}`);
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

      const current = await page.request.get("/api/households/current");
      expect(current.ok()).toBeTruthy();
      const household = (await current.json()).data as {
        householdId: string;
        personId: string;
      };

      // 3. Create checking account for recording matching transactions
      const accResponse = await page.request.post(
        `/api/households/${household.householdId}/accounts`,
        {
          data: {
            name: `Checking ${locale}`,
            type: "checking",
            currency: "PLN",
            ownerPersonIds: [household.personId],
            initialBalance: {
              amountNatural: "5000.00",
              capturedAt: new Date().toISOString(),
            },
          },
        },
      );
      expect(accResponse.ok(), await accResponse.text()).toBeTruthy();
      const account = (await accResponse.json()).data as { id: string };

      // 4. Navigate to Upcoming page
      await page.goto(`/${locale}/upcoming`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      // 5. Open Create Obligation form and submit
      const addBtnText =
        locale === "pl" ? "Dodaj zobowiązanie" : "Add obligation";
      await page.getByRole("button", { name: addBtnText }).first().click();

      await page
        .getByRole("textbox", { name: locale === "pl" ? "Tytuł" : "Title" })
        .fill(`Internet Fiber ${locale}`);
      await page
        .getByRole("textbox", { name: locale === "pl" ? "Kwota" : "Amount" })
        .fill("149.99");
      await page
        .getByRole("textbox", { name: locale === "pl" ? "Waluta" : "Currency" })
        .fill("PLN");
      await page.locator('input[type="date"]').fill("2026-09-25");
      await page
        .getByRole("textbox", { name: locale === "pl" ? /Notatki/ : /Notes/ })
        .fill("Contract #98765");

      await page.getByRole("button", { name: addBtnText }).last().click();

      // 6. Verify obligation appears in upcoming list
      await expect(
        page.getByText(`Internet Fiber ${locale}`, { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/149[,.]99/)).toBeVisible();

      const obligationsResponse = await page.request.get(
        `/api/households/${household.householdId}/obligations`,
      );
      expect(obligationsResponse.ok(), await obligationsResponse.text()).toBeTruthy();
      const createdObligation = ((await obligationsResponse.json()).data as Array<{ id: string }>)[0];
      const malformedCancel = await page.request.delete(
        `/api/households/${household.householdId}/obligations/${createdObligation.id}`,
        { data: "not-json" },
      );
      expect(malformedCancel.status()).toBe(400);
      const malformedCancelPost = await page.request.post(
        `/api/households/${household.householdId}/obligations/${createdObligation.id}/cancel`,
        { data: "not-json" },
      );
      expect(malformedCancelPost.status()).toBe(400);

      // 7. Verify Overview displays upcoming obligation
      await page.goto(`/${locale}`);
      await expect(page.getByText(/149[,.]99/)).toBeVisible();

      // 8. Record matching canonical expense transaction via API (exact currency and minor units)
      const txResponse = await page.request.post(
        `/api/households/${household.householdId}/transactions`,
        {
          data: {
            kind: "expense",
            accountId: account.id,
            amount: { amountMinor: "14999", currency: "PLN" },
            payee: `ISP Fiber Provider ${locale}`,
            paidByPersonId: household.personId,
            occurredOn: new Date().toISOString(),
          },
        },
      );
      expect(txResponse.ok(), await txResponse.text()).toBeTruthy();

      // 9. Go back to /upcoming and Match
      await page.goto(`/${locale}/upcoming`);
      const matchBtnText =
        locale === "pl" ? "Połącz z płatnością" : "Match payment";
      await page.getByRole("button", { name: matchBtnText }).first().click();

      // Verify modal and candidate payee are shown through the visible selector (options are not visible DOM nodes)
      const candidateSelect = page.locator("select").last();
      await expect(candidateSelect).toBeVisible();
      await expect(candidateSelect.locator("option:checked")).toContainText(
        `ISP Fiber Provider ${locale}`,
      );

      // Confirm match
      const confirmMatchBtnText =
        locale === "pl" ? "Potwierdź połączenie" : "Confirm match";
      await page.getByRole("button", { name: confirmMatchBtnText }).click();

      // 10. Verify obligation displays Paid status and matched payee
      await expect(
        page.getByText(locale === "pl" ? "Opłacone" : "Paid").first(),
      ).toBeVisible();
      await expect(
        page.getByText(`ISP Fiber Provider ${locale}`),
      ).toBeVisible();

      // 11. Unlink transaction
      page.on("dialog", (dialog) => dialog.accept());
      const unlinkBtnText = locale === "pl" ? "Odłącz" : "Unlink";
      await page.getByRole("button", { name: unlinkBtnText }).first().click();

      // 12. Verify status returns to Upcoming
      await expect(
        page.getByText(locale === "pl" ? "Nadchodzące" : "Upcoming").first(),
      ).toBeVisible();
    });
  }
});
