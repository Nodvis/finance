import { describe, expect, it } from "vitest";

import enMessages from "../../messages/en.json";
import plMessages from "../../messages/pl.json";

function getLeafKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...getLeafKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe("i18n localization messages", () => {
  it("has matching keys between Polish and English message catalogs", () => {
    const plKeys = getLeafKeys(plMessages);
    const enKeys = getLeafKeys(enMessages);

    expect(plKeys).toEqual(enKeys);
  });

  it("has non-empty strings for all Polish translations", () => {
    const plKeys = getLeafKeys(plMessages);
    for (const key of plKeys) {
      const parts = key.split(".");
      let current: any = plMessages;
      for (const part of parts) {
        current = current[part];
      }
      expect(typeof current).toBe("string");
      expect(current.trim().length).toBeGreaterThan(0);
    }
  });

  it("has non-empty strings for all English translations", () => {
    const enKeys = getLeafKeys(enMessages);
    for (const key of enKeys) {
      const parts = key.split(".");
      let current: any = enMessages;
      for (const part of parts) {
        current = current[part];
      }
      expect(typeof current).toBe("string");
      expect(current.trim().length).toBeGreaterThan(0);
    }
  });

  it("defines essential transaction and auth keys", () => {
    const plKeys = getLeafKeys(plMessages);
    expect(plKeys).toContain("Transactions.tabs.expense");
    expect(plKeys).toContain("Transactions.tabs.income");
    expect(plKeys).toContain("Transactions.tabs.transfer");
    expect(plKeys).toContain("Transactions.form.amountMinor");
    expect(plKeys).toContain("Transactions.form.transferRequiresTwoAccounts");
    expect(plKeys).toContain("Transactions.list.emptyTitle");
    expect(plKeys).toContain("Auth.signInButton");
    expect(plKeys).toContain("Auth.signOutButton");
  });

  it("defines language switcher, navigation, and accessibility keys in both catalogs", () => {
    const plKeys = getLeafKeys(plMessages);
    expect(plKeys).toContain("LanguageSwitcher.label");
    expect(plKeys).toContain("LanguageSwitcher.switchToPl");
    expect(plKeys).toContain("LanguageSwitcher.switchToEn");
    expect(plKeys).toContain("LanguageSwitcher.pl");
    expect(plKeys).toContain("LanguageSwitcher.en");
    expect(plKeys).toContain("Navigation.brand");
    expect(plKeys).toContain("Navigation.home");
    expect(plKeys).toContain("Navigation.skipToContent");
    expect(plKeys).toContain("Accessibility.languageNavigation");
    expect(plKeys).toContain("Accessibility.financialSummary");
    expect(plKeys).toContain("Footer.tagline");
  });

  it("does not expose technical minor-unit labels in user-facing amount labels", () => {
    expect(plMessages.Transactions.form.amountMinor).toBe("Kwota");
    expect(enMessages.Transactions.form.amountMinor).toBe("Amount");
    expect(plMessages.Transactions.form.amountMinor).not.toContain("jednostkach mniejszych");
    expect(enMessages.Transactions.form.amountMinor).not.toContain("minor units");
  });

  it("defines essential category navigation and form keys", () => {
    const plKeys = getLeafKeys(plMessages);
    expect(plKeys).toContain("Navigation.categories");
    expect(plKeys).toContain("Categories.title");
    expect(plKeys).toContain("Categories.activeCategories");
    expect(plKeys).toContain("Categories.archivedCategories");
    expect(plKeys).toContain("Categories.actions.addCategory");
    expect(plKeys).toContain("Categories.actions.archive");
    expect(plKeys).toContain("Categories.actions.unarchive");
    expect(plKeys).toContain("Categories.applicability.expense");
    expect(plKeys).toContain("Categories.applicability.income");
    expect(plKeys).toContain("Categories.applicability.both");
    expect(plKeys).toContain("Transactions.form.category");
    expect(plKeys).toContain("Transactions.list.colCategory");
    expect(plKeys).toContain("Accessibility.categoriesList");
  });
});
