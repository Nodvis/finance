import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { transactionId } from "@nodvis/finance-domain";
import { getDb } from "../client";
import { accounts, households, persons, householdMemberships } from "../schema/foundation";
import { transactions } from "../schema/transactions";
import { creditFacilities } from "../schema/credit-facilities";
import { createBnplPurchaseRecord, getBnplPurchase, updateBnplPurchaseRecord } from "./bnpl-purchases";

async function fixture(currency = "PLN") {
  const db = getDb();
  const householdId = crypto.randomUUID();
  const personId = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const creditFacilityId = crypto.randomUUID();
  const id = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "Synthetic BNPL", defaultCurrency: currency });
  await db.insert(persons).values({ id: personId, displayName: "Synthetic" });
  await db.insert(householdMemberships).values({ householdId, personId });
  await db.insert(accounts).values({ id: accountId, householdId, name: "Synthetic", type: "checking", currency });
  await db.insert(creditFacilities).values({ id: creditFacilityId, householdId, kind: "bnpl", name: "Synthetic", currency });
  await db.insert(transactions).values({ id, householdId, kind: "expense", amountMinor: 20000n, currency, accountId, paidByPersonId: personId, payee: "Synthetic merchant", occurredOn: new Date("2026-09-01T12:00:00Z") });
  return {
    householdId, creditFacilityId, currency, provider: "Synthetic", product: "Pay later", merchant: "Synthetic merchant",
    purchaseDate: new Date("2026-09-01T12:00:00Z"), financingDate: new Date("2026-09-01T12:00:00Z"),
    originalAmountMinor: 20000n, financedAmountMinor: 20000n, paymentModel: "pay_in_full" as const,
    transactionId: transactionId(id),
  };
}

describe.runIf(Boolean(process.env.DATABASE_URL))("BNPL canonical transaction boundary", () => {
  it("rejects a transaction belonging to another household on creation", async () => {
    const a = await fixture();
    const b = await fixture();
    await expect(createBnplPurchaseRecord({ ...a, transactionId: b.transactionId })).rejects.toThrow("BNPL purchase transaction is invalid");
  });
  it("rejects cross-household reassignment without modifying the purchase", async () => {
    const a = await fixture();
    const b = await fixture();
    const row = await createBnplPurchaseRecord(a);
    await expect(updateBnplPurchaseRecord(a.householdId, row.id, row.version, { transactionId: b.transactionId })).rejects.toThrow("BNPL purchase transaction is invalid");
    expect((await getBnplPurchase(a.householdId, row.id)).transactionId).toBe(a.transactionId);
  });
  it("rejects a same-household expense in a different currency", async () => {
    const a = await fixture();
    await getDb().update(transactions).set({ currency: "EUR" }).where(eq(transactions.id, a.transactionId));
    await expect(createBnplPurchaseRecord(a)).rejects.toThrow("BNPL purchase transaction is invalid");
  });
  it("rejects a different amount instead of guessing a partial purchase link", async () => {
    const a = await fixture();
    await expect(createBnplPurchaseRecord({ ...a, originalAmountMinor: 30000n })).rejects.toThrow("BNPL purchase transaction is invalid");
  });
  it("rejects voided canonical expenses", async () => {
    const a = await fixture();
    await getDb().update(transactions).set({ voidedAt: new Date() }).where(eq(transactions.id, a.transactionId));
    await expect(createBnplPurchaseRecord(a)).rejects.toThrow("BNPL purchase transaction is invalid");
  });
  it("preserves exact amounts above Number.MAX_SAFE_INTEGER", async () => {
    const a = await fixture();
    const amount = 9007199254740993n;
    await getDb().update(transactions).set({ amountMinor: amount }).where(eq(transactions.id, a.transactionId));
    const row = await createBnplPurchaseRecord({ ...a, originalAmountMinor: amount, financedAmountMinor: amount });
    expect(row.originalAmountMinor).toBe(amount);
    expect(row.transactionId).toBe(a.transactionId);
  });
  it("allows only one concurrent correction at the same version", async () => {
    const a = await fixture();
    const row = await createBnplPurchaseRecord(a);
    const results = await Promise.allSettled([
      updateBnplPurchaseRecord(a.householdId, row.id, 1, { description: "First" }),
      updateBnplPurchaseRecord(a.householdId, row.id, 1, { description: "Second" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await getBnplPurchase(a.householdId, row.id)).version).toBe(2);
  });
});
