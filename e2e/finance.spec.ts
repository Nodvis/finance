import { expect, test, type Page } from "@playwright/test";

const password = "LocalOnly-E2E-Password-123!";

type Household = { householdId: string; personId: string };
type Account = { id: string; name: string };

async function createUserAndHousehold(page: Page, locale: "pl" | "en"): Promise<Household> {
  const email = `e2e-${locale}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const signUp = await page.request.post("/api/auth/sign-up/email", {
    data: { name: `E2E ${locale}`, email, password },
  });
  expect(signUp.ok(), `signup ${signUp.status()} ${await signUp.text()}`).toBeTruthy();

  await page.goto(`/${locale}`);
  await page.locator("#onboarding-name").fill(`E2E Household ${locale}`);
  await page.locator("#onboarding-person").fill(`E2E Person ${locale}`);
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("/api/households") && response.request().method() === "POST",
    ),
    page.locator("form").filter({ has: page.locator("#onboarding-name") }).getByRole("button").click(),
  ]);
  await expect(page.getByRole("heading").first()).toBeVisible();

  const current = await page.request.get("/api/households/current");
  expect(current.ok(), `current ${current.status()} ${await current.text()}`).toBeTruthy();
  const body = (await current.json()).data as Household;
  expect(body.householdId).toBeTruthy();
  expect(body.personId).toBeTruthy();
  return body;
}

async function createAccounts(page: Page, household: Household): Promise<[Account, Account]> {
  const make = async (name: string, amount: string) => {
    const response = await page.request.post(`/api/households/${household.householdId}/accounts`, {
      data: {
        name,
        type: "checking",
        currency: "PLN",
        ownerPersonIds: [household.personId],
        initialBalance: { amountNatural: amount, capturedAt: new Date().toISOString() },
      },
    });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).data as Account;
  };
  return [await make("E2E Main", "1000"), await make("E2E Savings", "500")];
}

async function createCategory(page: Page, locale: "pl" | "en"): Promise<string> {
  await page.goto(`/${locale}/categories`);
  await page.getByRole("button", { name: /Add category|Dodaj kategorię/ }).click();
  const name = `E2E Groceries ${locale} ${Date.now()}`;
  await page.locator("#create-category-name").fill(name);
  await page.getByRole("button", { name: /Create category|Utwórz kategorię/ }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  const categories = await page.request.get(`/api/households/current`);
  expect(categories.ok()).toBeTruthy();
  const householdId = ((await categories.json()).data as Household).householdId;
  const list = await page.request.get(`/api/households/${householdId}/categories`);
  expect(list.ok()).toBeTruthy();
  const found = ((await list.json()).data as Array<{ id: string; name: string }>).find((item) => item.name === name);
  expect(found).toBeTruthy();
  return found!.id;
}

async function addExpense(page: Page, locale: "pl" | "en", accountName: string, categoryId: string, payee: string) {
  await page.goto(`/${locale}`);
  await page.locator("#single-account").selectOption({ label: `${accountName} (PLN)` });
  await page.locator("#transaction-category").selectOption(categoryId);
  await page.locator("#amount-input").fill("12.34");
  await page.locator("#expense-payee").fill(payee);
  await page.getByRole("button", { name: /Zapisz wydatek|Add expense|Save expense/ }).click();
  await expect(page.getByText(payee, { exact: true }).first()).toBeVisible();
}

async function addIncome(page: Page, locale: "pl" | "en", accountName: string, source: string) {
  await page.getByRole("tab", { name: /Income|Przychód/ }).click();
  await page.locator("#single-account").selectOption({ label: `${accountName} (PLN)` });
  await page.locator("#amount-input").fill("45.67");
  await page.locator("#income-source").fill(source);
  await page.getByRole("button", { name: /Zapisz przychód|Add income|Save income/ }).click();
  await expect(page.getByText(source, { exact: true }).first()).toBeVisible();
}

async function addTransfer(page: Page, locale: "pl" | "en", from: string, to: string) {
  await page.getByRole("tab", { name: /Transfer|Przelew/ }).click();
  await page.locator("#from-account").selectOption({ label: `${from} (PLN)` });
  await page.locator("#to-account").selectOption({ label: `${to} (PLN)` });
  await page.locator("#amount-input").fill("5.55");
  await page.getByRole("button", { name: /Zapisz przelew|Save transfer|Record transfer/ }).click();
  await expect(page.getByText(new RegExp(`${from}.*${to}`)).first()).toBeVisible();
}

async function runLocaleFlow(page: Page, locale: "pl" | "en") {
  const household = await createUserAndHousehold(page, locale);
  const [main, savings] = await createAccounts(page, household);
  const categoryId = await createCategory(page, locale);

  await page.goto(`/${locale}/imports?accountId=${main.id}`);
  await page.locator('input[type="file"]').setInputFiles({
    name: `synthetic-${locale}.csv`,
    mimeType: "text/csv",
    buffer: (globalThis as unknown as { Buffer: { from(value: string): unknown } }).Buffer.from(
      "Date,Amount,Description\n2026-03-10,-12.34,Imported expense " +
        locale +
        "\nnot-a-date,-5.00,Rejected row " +
        locale +
        "\n",
    ) as never,
  });
  await page.getByRole("button", { name: /Inspect file|Sprawdź plik/ }).click();
  await expect(page.getByText(/Detected delimiter|Wykryto separator/)).toBeVisible();
  await page.getByRole("button", { name: /Preview rows|Podgląd wierszy/ }).click();
  await expect(page.getByText(/2 rows: 1 valid, 1 invalid|2 wierszy: 1 poprawnych, 1 błędnych/)).toBeVisible();
  await expect(page.getByText(`Imported expense ${locale}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Import 1 selected row|Importuj 1 zaznaczonych wierszy/ }).click();
  await expect(page.getByText(/Imported 1 transactions|Zaimportowano 1 transakcji\./)).toBeVisible();

  await page.goto(`/${locale}/imports?accountId=${main.id}`);
  await page.locator('input[type="file"]').setInputFiles({
    name: `synthetic-${locale}.csv`,
    mimeType: "text/csv",
    buffer: (globalThis as unknown as { Buffer: { from(value: string): unknown } }).Buffer.from(
      "Date,Amount,Description\n2026-03-10,-12.34,Imported expense " + locale + "\nnot-a-date,-5.00,Rejected row " + locale + "\n",
    ) as never,
  });
  await page.getByRole("button", { name: /Inspect file|Sprawdź plik/ }).click();
  await page.getByRole("button", { name: /Preview rows|Podgląd wierszy/ }).click();
  await expect(page.getByText(/duplicates|duplikat|automatically processed|automatyczne przetworzenie/)).toBeVisible();

  const importedList = await page.request.get(`/api/households/${household.householdId}/transactions?status=all`);
  expect(importedList.ok()).toBeTruthy();
  const imported = ((await importedList.json()).data as Array<Record<string, unknown>>).find(
    (tx) => tx.payee === `Imported expense ${locale}`,
  );
  expect(imported).toBeTruthy();
  expect((imported!.amount as { amountMinor: string }).amountMinor).toBe("1234");

  await addExpense(page, locale, main.name, categoryId, `E2E expense ${locale}`);
  await addIncome(page, locale, main.name, `E2E income ${locale}`);
  await addTransfer(page, locale, main.name, savings.name);

  const list = await page.request.get(`/api/households/${household.householdId}/transactions?status=all`);
  expect(list.ok()).toBeTruthy();
  const transactions = (await list.json()).data as Array<Record<string, unknown>>;
  const expense = transactions.find((tx) => tx.payee === `E2E expense ${locale}`)!;
  const income = transactions.find((tx) => tx.source === `E2E income ${locale}`)!;
  const transfer = transactions.find((tx) => tx.kind === "transfer")!;
  expect(expense).toBeTruthy();
  expect(income).toBeTruthy();
  expect(transfer).toBeTruthy();

  const editButton = page.getByRole("button", { name: new RegExp(`Edit.*E2E expense ${locale}|Edytuj.*E2E expense ${locale}`) });
  await editButton.click();
  await page.locator("#edit-payee").fill(`E2E corrected expense ${locale}`);
  await page.locator("#edit-amount").fill("20.01");
  await page.getByRole("dialog").getByRole("button", { name: /Save changes|Zapisz zmiany/ }).click();
  await expect(page.getByText(`E2E corrected expense ${locale}`, { exact: true }).first()).toBeVisible();

  const incomeEdit = page.getByRole("button", { name: new RegExp(`Edit.*E2E income ${locale}|Edytuj.*E2E income ${locale}`) });
  await incomeEdit.click();
  await page.locator("#edit-source").fill(`E2E corrected income ${locale}`);
  await page.locator("#edit-amount").fill("46.78");
  await page.getByRole("dialog").getByRole("button", { name: /Save changes|Zapisz zmiany/ }).click();
  await expect(page.getByText(`E2E corrected income ${locale}`, { exact: true }).first()).toBeVisible();

  const transferEdit = page.getByRole("button", { name: new RegExp("Edit.*E2E Main|Edytuj.*E2E Main") }).last();
  await transferEdit.click();
  await page.locator("#edit-amount").fill("6.66");
  await page.getByRole("dialog").getByRole("button", { name: /Save changes|Zapisz zmiany/ }).click();

  const voidButton = page.getByRole("button", { name: new RegExp(`Void.*E2E corrected expense ${locale}|Anuluj.*E2E corrected expense ${locale}`) });
  await voidButton.click();
  await page.locator("#void-reason").fill("E2E correction test");
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/void") && response.request().method() === "POST"),
    page.getByRole("dialog").getByRole("button", { name: /Confirm void|Potwierdź anulowanie/ }).click(),
  ]);

  const after = await page.request.get(`/api/households/${household.householdId}/transactions?status=all`);
  const afterTransactions = (await after.json()).data as Array<Record<string, unknown>>;
  const correctedExpense = afterTransactions.find((tx) => tx.id === expense.id)!;
  const correctedIncome = afterTransactions.find((tx) => tx.id === income.id)!;
  const correctedTransfer = afterTransactions.find((tx) => tx.id === transfer.id)!;
  expect(correctedExpense.voidedAt).toBeTruthy();
  expect(correctedExpense.voidReason).toBe("E2E correction test");
  expect(correctedIncome.source).toBe(`E2E corrected income ${locale}`);
  expect(correctedTransfer.amount).toEqual({ amountMinor: "666", currency: "PLN" });

  const historyResponse = await page.request.get(
    `/api/households/${household.householdId}/transactions/${expense.id}/history`,
  );
  expect(historyResponse.ok()).toBeTruthy();
  const history = (await historyResponse.json()).data.history as Array<Record<string, unknown>>;
  expect(history.map((entry) => entry.revision)).toEqual([1, 2, 3]);
  expect(history.map((entry) => entry.operation)).toEqual(["create", "correction", "void"]);
  expect((history[2]!.voidReason as string)).toBe("E2E correction test");

  await page.goto(`/${locale}?status=all`);
  await page.getByRole("button", {
    name: new RegExp(`Details.*E2E corrected expense ${locale}|Szczegóły.*E2E corrected expense ${locale}`),
  }).click();
  await page.getByRole("dialog").getByRole("button", {
    name: /Change history|Historia zmian/,
  }).click();
  await expect(page.getByText(/Revision 3|Rewizja 3/)).toBeVisible();
  await expect(page.getByText("E2E correction test", { exact: true })).toBeVisible();

  const overview = await page.request.get(`/api/households/${household.householdId}/overview?month=${new Date().toISOString().slice(0, 7)}`);
  expect(overview.ok()).toBeTruthy();
  expect((await overview.json()).data.cashFlow.byCurrency).toBeTruthy();

  for (let i = 0; i < 11; i += 1) {
    const response = await page.request.post(`/api/households/${household.householdId}/transactions`, {
      data: {
        kind: "expense",
        accountId: main.id,
        amountMinor: "101",
        currency: "PLN",
        payee: `E2E pagination ${locale} ${i}`,
        occurredOn: new Date().toISOString(),
        submissionId: `e2e-pagination-${locale}-${Date.now()}-${i}`,
      },
    });
    expect(response.ok()).toBeTruthy();
  }

  await page.reload();
  await page.locator("#tx-filter-search").fill(`E2E pagination ${locale}`);
  await expect(page.getByText(/Showing|Wyświetlanie/)).toBeVisible();
  await page.locator("#tx-page-size").selectOption("10");
  await expect(page.getByText(/(?:Showing|Wyświetlanie)\s+1[–-]10/)).toBeVisible();
  const nextPage = page.getByRole("button", { name: /^(Next|Następna)$/ });
  await expect(nextPage).toBeEnabled();
  await nextPage.click();
  await expect(page.getByText(/Page 2 of 2|Strona 2 z 2/)).toBeVisible();
  await expect(page.locator('a[download]')).toHaveAttribute("href", /\/transactions\/export\?/);

  await page.goto(`/${locale}/categories`);
  await expect(page.getByText(new RegExp(`E2E Groceries ${locale}`))).toBeVisible();
}

test.describe("authenticated finance browser flows", () => {
  test.setTimeout(120_000);
  test.describe.configure({ mode: "serial" });
  test("Polish end-to-end household flow", async ({ page }) => {
    await test.step("authenticated pl finance flow", () => runLocaleFlow(page, "pl"));
  });
  test("English end-to-end household flow", async ({ page }) => {
    await test.step("authenticated en finance flow", () => runLocaleFlow(page, "en"));
  });
});
