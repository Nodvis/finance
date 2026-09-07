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
});
