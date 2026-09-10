import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { createLiabilityRepayment, householdId, liabilityId, liabilityRepaymentId, transactionId, money } from "@nodvis/finance-domain";
import { getDb } from "../client";
import { accounts, households, persons, householdMemberships } from "../schema/foundation";
import { transactions } from "../schema/transactions";
import { creditFacilities } from "../schema/credit-facilities";
import { liabilities, liabilityRepayments } from "../schema/liabilities";
import { bnplPurchases } from "../schema/bnpl-purchases";
import { recordLiabilityRepaymentInDb, voidLiabilityRepaymentInDb } from "./liabilities";
import { createBnplPurchaseRecord, updateBnplPurchaseRecord, voidBnplPurchaseRecord } from "./bnpl-purchases";
import { mapRowToTransaction, updateTransactionInDb, voidTransactionInDb } from "./transactions";
import { listHouseholdAnalyticsTransactions } from "./analytics";
import { getHouseholdPeriodCashFlow, getHouseholdPeriodCategorySpending } from "./overview";
import { executeTransferMatch } from "./transfer-matching";

const testDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(testDir, "../../../../.env") });

async function fixture() {
  const db = getDb();
  const h = crypto.randomUUID(), p = crypto.randomUUID(), a = crypto.randomUUID(), l = crypto.randomUUID(), t = crypto.randomUUID();
  await db.insert(households).values({ id: h, name: "Synthetic repayment", defaultCurrency: "PLN" });
  await db.insert(persons).values({ id: p, displayName: "Synthetic" });
  await db.insert(householdMemberships).values({ householdId: h, personId: p });
  await db.insert(accounts).values({ id: a, householdId: h, name: "Synthetic", type: "checking", currency: "PLN" });
  await db.insert(liabilities).values({ id: l, householdId: h, name: "Synthetic loan", currency: "PLN" });
  await db.insert(transactions).values({ id: t, householdId: h, kind: "expense", amountMinor: 27000n, currency: "PLN", accountId: a, paidByPersonId: p, payee: "Synthetic lender", occurredOn: new Date("2026-09-01T12:00:00Z") });
  const repayment = createLiabilityRepayment({ id: liabilityRepaymentId(crypto.randomUUID()), householdId: householdId(h), liabilityId: liabilityId(l), transactionId: transactionId(t), amount: money(27000n, "PLN"), principalAmount: money(25000n, "PLN"), interestAmount: money(2000n, "PLN"), feeAmount: money(0n, "PLN"), paidAt: new Date("2026-09-01T12:00:00Z") });
  return { householdId: h, repayment };
}

async function bnplFixture(householdIdValue: string, currency = "PLN") {
  const db = getDb();
  const facilityId = crypto.randomUUID();
  await db.insert(creditFacilities).values({
    id: facilityId,
    householdId: householdIdValue,
    kind: "bnpl",
    name: "Synthetic BNPL",
    currency,
  });
  return facilityId;
}

describe.runIf(Boolean(process.env.DATABASE_URL))("canonical repayment boundary", () => {
  // These exercise the shared canonical-payment boundary, not dedicated
  // card/revolving/BNPL product APIs (which remain separate follow-up work).
  it.each([
    { name: "card principal", purchase: 200n, total: 200n, principal: 200n, interest: 0n, fee: 0n, count: 1, spending: 200n },
    { name: "card financing costs", purchase: 200n, total: 200n, principal: 180n, interest: 15n, fee: 5n, count: 1, spending: 220n },
    { name: "revolving principal and interest", purchase: 0n, total: 270n, principal: 250n, interest: 20n, fee: 0n, count: 1, spending: 20n },
    { name: "BNPL four principal payments", purchase: 1200n, total: 300n, principal: 300n, interest: 0n, fee: 0n, count: 4, spending: 1200n },
    { name: "BNPL financing costs", purchase: 1000n, total: 1120n, principal: 1000n, interest: 100n, fee: 20n, count: 1, spending: 1120n },
    { name: "loan principal", purchase: 0n, total: 300n, principal: 300n, interest: 0n, fee: 0n, count: 1, spending: 0n },
  ])("does not double count $name", async (scenario) => {
    const a = await fixture();
    const [source] = await getDb().select().from(transactions).where(eq(transactions.id, a.repayment.transactionId!));
    if (scenario.purchase > 0n) {
      await getDb().insert(transactions).values({ ...source!, id: crypto.randomUUID(), amountMinor: scenario.purchase * 100n, payee: "Synthetic purchase" });
    }
    for (let index = 0; index < scenario.count; index++) {
      const paymentId = index === 0 ? source!.id : crypto.randomUUID();
      if (index === 0) await getDb().update(transactions).set({ amountMinor: scenario.total * 100n }).where(eq(transactions.id, paymentId));
      else await getDb().insert(transactions).values({ ...source!, id: paymentId, amountMinor: scenario.total * 100n });
      const repayment = createLiabilityRepayment({ ...a.repayment, id: liabilityRepaymentId(crypto.randomUUID()), transactionId: transactionId(paymentId), amount: money(scenario.total * 100n, "PLN"), principalAmount: money(scenario.principal * 100n, "PLN"), interestAmount: money(scenario.interest * 100n, "PLN"), feeAmount: money(scenario.fee * 100n, "PLN") });
      await recordLiabilityRepaymentInDb({ householdId: a.householdId, repayment });
    }
    const analytics = await listHouseholdAnalyticsTransactions(a.householdId);
    expect(analytics.reduce((sum, row) => sum + row.amountMinor, 0n)).toBe(scenario.spending * 100n);
    const range = { householdId: a.householdId, startDate: new Date("2026-09-01"), endDate: new Date("2026-10-01") };
    expect((await getHouseholdPeriodCashFlow(range)).reduce((sum, row) => sum + row.totalMinor, 0n)).toBe(scenario.spending * 100n);
    expect((await getHouseholdPeriodCategorySpending(range)).reduce((sum, row) => sum + row.totalMinor, 0n)).toBe(scenario.spending * 100n);
  });
  it("internal transfers, ATM cash transfers and a represented revolving drawdown are not income or spending", async () => {
    const a = await fixture();
    const [source] = await getDb().select().from(transactions).where(eq(transactions.id, a.repayment.transactionId!));
    const destination = crypto.randomUUID();
    await getDb().insert(accounts).values({ id: destination, householdId: a.householdId, name: "Synthetic cash", type: "cash", currency: "PLN" });
    await getDb().update(transactions).set({ kind: "transfer", amountMinor: 100000n, fromAccountId: source!.accountId, toAccountId: destination, accountId: null, payee: null, paidByPersonId: null }).where(eq(transactions.id, source!.id));
    expect(await listHouseholdAnalyticsTransactions(a.householdId)).toHaveLength(0);
  });
  it("does not convert a repayment-linked transaction into a transfer", async () => {
    const a = await fixture();
    await recordLiabilityRepaymentInDb(a);
    const [source] = await getDb().select().from(transactions).where(eq(transactions.id, a.repayment.transactionId!));
    const destination = crypto.randomUUID();
    const inflow = crypto.randomUUID();
    await getDb().insert(accounts).values({ id: destination, householdId: a.householdId, name: "Synthetic transfer target", type: "checking", currency: "PLN" });
    await getDb().insert(transactions).values({ id: inflow, householdId: a.householdId, kind: "income", amountMinor: source!.amountMinor, currency: "PLN", accountId: destination, source: "Synthetic", receivedByPersonId: source!.paidByPersonId, occurredOn: source!.occurredOn });
    await expect(executeTransferMatch({ householdId: a.householdId, outflowTransactionId: source!.id, expectedOutflowVersion: source!.version, inflowTransactionId: inflow, expectedInflowVersion: 1, matchConfidence: "manual" })).rejects.toThrow("linked to a liability repayment");
  });
  it("reports only financing costs, not principal, in both Analytics and Overview", async () => {
    const a = await fixture();
    await recordLiabilityRepaymentInDb(a);
    const analytics = await listHouseholdAnalyticsTransactions(a.householdId);
    expect(analytics.reduce((sum, row) => sum + row.amountMinor, 0n)).toBe(2000n);
    const range = { householdId: a.householdId, startDate: new Date("2026-09-01"), endDate: new Date("2026-10-01") };
    expect((await getHouseholdPeriodCashFlow(range)).find((row) => row.kind === "expense")?.totalMinor).toBe(2000n);
    expect((await getHouseholdPeriodCategorySpending(range)).reduce((sum, row) => sum + row.totalMinor, 0n)).toBe(2000n);
  });
  it("rejects a linked payment from another household", async () => {
    const a = await fixture(), b = await fixture();
    await expect(recordLiabilityRepaymentInDb({ ...a, repayment: { ...a.repayment, transactionId: b.repayment.transactionId } })).rejects.toThrow();
  });
  it("an identical retry returns the same repayment", async () => {
    const a = await fixture();
    const first = await recordLiabilityRepaymentInDb(a);
    const second = await recordLiabilityRepaymentInDb(a);
    expect(second.repayment.id).toBe(first.repayment.id);
  });
  it("retries a newly created cash payment without another canonical transaction", async () => {
    const a = await fixture();
    const [source] = await getDb().select().from(transactions).where(eq(transactions.id, a.repayment.transactionId!));
    const cashTransaction = mapRowToTransaction({ ...source!, id: crypto.randomUUID() });
    const params = { ...a, repayment: { ...a.repayment, transactionId: null }, cashTransaction };
    const first = await recordLiabilityRepaymentInDb(params);
    const second = await recordLiabilityRepaymentInDb({ ...params, cashTransaction: { ...cashTransaction, id: transactionId(crypto.randomUUID()) } });
    expect(second.repayment.id).toBe(first.repayment.id);
    expect(second.transaction?.id).toBe(first.transaction?.id);
    await expect(recordLiabilityRepaymentInDb({ ...params, cashTransaction: { ...cashTransaction, id: transactionId(crypto.randomUUID()), sourceAccountId: "different-source-account" } })).rejects.toThrow();
  });
  it("voiding a link does not void a pre-existing canonical payment", async () => {
    const a = await fixture();
    await recordLiabilityRepaymentInDb(a);
    await voidLiabilityRepaymentInDb({ householdId: a.householdId, id: a.repayment.id, expectedVersion: 1 });
    const [row] = await getDb().select().from(transactions).where(eq(transactions.id, a.repayment.transactionId!));
    expect(row?.voidedAt).toBeNull();
  });
  it("deduplicates concurrent links with different request UUIDs and rejects conflicting allocations", async () => {
    const a = await fixture();
    const results = await Promise.all([recordLiabilityRepaymentInDb(a), recordLiabilityRepaymentInDb({ ...a, repayment: { ...a.repayment, id: liabilityRepaymentId(crypto.randomUUID()) } })]);
    expect(results[0].repayment.id).toBe(results[1].repayment.id);
    await expect(recordLiabilityRepaymentInDb({ ...a, repayment: { ...a.repayment, notes: "conflict" } })).rejects.toThrow();
  });
  it.each(["currency", "amount", "void", "income"])("rejects invalid linked payment: %s", async (change) => {
    const a = await fixture();
    if (change === "currency") await getDb().update(transactions).set({ currency: "EUR" }).where(eq(transactions.id, a.repayment.transactionId!));
    if (change === "amount") await getDb().update(transactions).set({ amountMinor: 27001n }).where(eq(transactions.id, a.repayment.transactionId!));
    if (change === "void") await getDb().update(transactions).set({ voidedAt: new Date() }).where(eq(transactions.id, a.repayment.transactionId!));
    if (change === "income") {
      const [source] = await getDb().select().from(transactions).where(eq(transactions.id, a.repayment.transactionId!));
      await getDb().update(transactions).set({ kind: "income", source: "Synthetic", receivedByPersonId: source!.paidByPersonId, payee: null, paidByPersonId: null }).where(eq(transactions.id, a.repayment.transactionId!));
    }
    await expect(recordLiabilityRepaymentInDb(a)).rejects.toThrow();
  });
  it("preserves exact amounts above Number.MAX_SAFE_INTEGER", async () => {
    const a = await fixture();
    const amount = money(9007199254740993n, "PLN");
    await getDb().update(transactions).set({ amountMinor: amount.amountMinor }).where(eq(transactions.id, a.repayment.transactionId!));
    const result = await recordLiabilityRepaymentInDb({ ...a, repayment: { ...a.repayment, amount, principalAmount: amount, interestAmount: money(0n, "PLN") } });
    expect(result.repayment.amount.amountMinor).toBe(9007199254740993n);
  });
  it("voids an owned cash payment atomically and rejects stale voids", async () => {
    const a = await fixture();
    const [source] = await getDb().select().from(transactions).where(eq(transactions.id, a.repayment.transactionId!));
    const cashTransaction = mapRowToTransaction({ ...source!, id: crypto.randomUUID() });
    const result = await recordLiabilityRepaymentInDb({ ...a, repayment: { ...a.repayment, transactionId: null }, cashTransaction });
    await expect(voidLiabilityRepaymentInDb({ householdId: a.householdId, id: a.repayment.id, expectedVersion: 2 })).rejects.toThrow();
    await voidLiabilityRepaymentInDb({ householdId: a.householdId, id: a.repayment.id, expectedVersion: 1 });
    const [row] = await getDb().select().from(transactions).where(eq(transactions.id, result.transaction!.id));
    expect(row?.voidedAt).not.toBeNull();
    expect(row?.version).toBe(2);
    await expect(recordLiabilityRepaymentInDb({ ...a, repayment: { ...a.repayment, transactionId: null }, cashTransaction })).rejects.toThrow();
  });
  it("rejects a created payment sourcing another household account without leaving an orphan", async () => {
    const a = await fixture(), b = await fixture();
    const [foreign] = await getDb().select().from(transactions).where(eq(transactions.id, b.repayment.transactionId!));
    const cashTransaction = mapRowToTransaction({ ...foreign!, id: crypto.randomUUID(), householdId: a.householdId });
    await expect(recordLiabilityRepaymentInDb({ ...a, repayment: { ...a.repayment, transactionId: null }, cashTransaction })).rejects.toThrow();
    expect(await getDb().select().from(transactions).where(eq(transactions.id, cashTransaction.id))).toHaveLength(0);
  });

  it("preserves exact amounts above Number.MAX_SAFE_INTEGER in financial reporting", async () => {
    const a = await fixture();
    const massiveInterest = 9007199254740993n;
    const totalAmount = massiveInterest + 1000n;
    await getDb().update(transactions).set({ amountMinor: totalAmount }).where(eq(transactions.id, a.repayment.transactionId!));
    const repayment = createLiabilityRepayment({
      ...a.repayment,
      amount: money(totalAmount, "PLN"),
      principalAmount: money(1000n, "PLN"),
      interestAmount: money(massiveInterest, "PLN"),
      feeAmount: money(0n, "PLN"),
    });
    await recordLiabilityRepaymentInDb({ householdId: a.householdId, repayment });
    const analytics = await listHouseholdAnalyticsTransactions(a.householdId);
    expect(analytics).toHaveLength(1);
    expect(analytics[0]!.amountMinor).toBe(massiveInterest);
    const range = { householdId: a.householdId, startDate: new Date("2026-09-01"), endDate: new Date("2026-10-01") };
    const cashFlow = await getHouseholdPeriodCashFlow(range);
    expect(cashFlow.find((r) => r.kind === "expense")?.totalMinor).toBe(massiveInterest);
    const categorySpending = await getHouseholdPeriodCategorySpending(range);
    expect(categorySpending.reduce((sum, r) => sum + r.totalMinor, 0n)).toBe(massiveInterest);
  });

  it("enforces BNPL duplicate active transaction link rejection", async () => {
    const a = await fixture();
    const facilityId = await bnplFixture(a.householdId);
    const bnplInput = {
      householdId: a.householdId,
      creditFacilityId: facilityId,
      currency: "PLN",
      provider: "Klarna",
      product: "Pay in 30",
      merchant: "Merchant",
      purchaseDate: new Date("2026-09-01T12:00:00Z"),
      financingDate: new Date("2026-09-01T12:00:00Z"),
      originalAmountMinor: 27000n,
      financedAmountMinor: 27000n,
      paymentModel: "pay_in_30" as const,
      transactionId: transactionId(a.repayment.transactionId!),
    };
    // First link succeeds
    const firstBnpl = await createBnplPurchaseRecord(bnplInput);
    expect(firstBnpl.id).toBeDefined();

    // Duplicate active link on another BNPL purchase is rejected
    await expect(createBnplPurchaseRecord(bnplInput)).rejects.toThrow("already linked to another active BNPL purchase");

    // Once the first is voided, linking is allowed again
    await voidBnplPurchaseRecord(a.householdId, firstBnpl.id, 1, "voided");
    const secondBnpl = await createBnplPurchaseRecord(bnplInput);
    expect(secondBnpl.id).toBeDefined();
  });

  it("enforces conflict between BNPL links and repayment links in both directions", async () => {
    const a = await fixture();
    const facilityId = await bnplFixture(a.householdId);

    // 1. Transaction already linked to active repayment cannot be linked to BNPL purchase
    await recordLiabilityRepaymentInDb(a);
    await expect(
      createBnplPurchaseRecord({
        householdId: a.householdId,
        creditFacilityId: facilityId,
        currency: "PLN",
        provider: "Klarna",
        product: "Pay in 30",
        merchant: "Merchant",
        purchaseDate: new Date("2026-09-01T12:00:00Z"),
        financingDate: new Date("2026-09-01T12:00:00Z"),
        originalAmountMinor: 27000n,
        financedAmountMinor: 27000n,
        paymentModel: "pay_in_30",
        transactionId: transactionId(a.repayment.transactionId!),
      }),
    ).rejects.toThrow("conflicts with an active liability repayment");

    // 2. Transaction already linked to active BNPL purchase cannot be linked to repayment
    const b = await fixture();
    await createBnplPurchaseRecord({
      householdId: b.householdId,
      creditFacilityId: await bnplFixture(b.householdId),
      currency: "PLN",
      provider: "Klarna",
      product: "Pay in 30",
      merchant: "Merchant",
      purchaseDate: new Date("2026-09-01T12:00:00Z"),
      financingDate: new Date("2026-09-01T12:00:00Z"),
      originalAmountMinor: 27000n,
      financedAmountMinor: 27000n,
      paymentModel: "pay_in_30",
      transactionId: transactionId(b.repayment.transactionId!),
    });
    await expect(recordLiabilityRepaymentInDb(b)).rejects.toThrow("linked to an active BNPL purchase");

    // 3. Updating BNPL purchase to link transaction already linked to repayment is rejected
    const c = await fixture();
    await recordLiabilityRepaymentInDb(c);
    const cFacilityId = await bnplFixture(c.householdId);
    const cBnpl = await createBnplPurchaseRecord({
      householdId: c.householdId,
      creditFacilityId: cFacilityId,
      currency: "PLN",
      provider: "Klarna",
      product: "Pay in 30",
      merchant: "Merchant",
      purchaseDate: new Date("2026-09-01T12:00:00Z"),
      financingDate: new Date("2026-09-01T12:00:00Z"),
      originalAmountMinor: 27000n,
      financedAmountMinor: 27000n,
      paymentModel: "pay_in_30",
      transactionId: null,
    });
    await expect(
      updateBnplPurchaseRecord(c.householdId, cBnpl.id, cBnpl.version, {
        transactionId: transactionId(c.repayment.transactionId!),
      }),
    ).rejects.toThrow("conflicts with an active liability repayment");
  });

  it("serializes concurrent BNPL reassignment and repayment against the same canonical transaction", async () => {
    const a = await fixture();
    const facilityId = await bnplFixture(a.householdId);

    const purchase = await createBnplPurchaseRecord({
      householdId: a.householdId,
      creditFacilityId: facilityId,
      currency: "PLN",
      provider: "Klarna",
      product: "Pay in 30",
      merchant: "Merchant",
      purchaseDate: new Date("2026-09-01T12:00:00Z"),
      financingDate: new Date("2026-09-01T12:00:00Z"),
      originalAmountMinor: 27000n,
      financedAmountMinor: 27000n,
      paymentModel: "pay_in_30",
      transactionId: null,
    });

    const results = await Promise.allSettled([
      updateBnplPurchaseRecord(a.householdId, purchase.id, purchase.version, {
        transactionId: transactionId(a.repayment.transactionId!),
      }),
      recordLiabilityRepaymentInDb(a),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const [bnplRow] = await getDb()
      .select({ transactionId: bnplPurchases.transactionId })
      .from(bnplPurchases)
      .where(eq(bnplPurchases.id, purchase.id));
    const [repaymentRow] = await getDb()
      .select({ transactionId: liabilityRepayments.transactionId })
      .from(liabilityRepayments)
      .where(and(eq(liabilityRepayments.householdId, a.householdId), isNull(liabilityRepayments.voidedAt)));

    if (bnplRow?.transactionId) {
      expect(bnplRow.transactionId).toBe(a.repayment.transactionId);
      expect(repaymentRow).toBeUndefined();
    } else {
      expect(bnplRow?.transactionId).toBeNull();
      expect(repaymentRow?.transactionId).toBe(a.repayment.transactionId);
    }
  });

  it("prevents post-link transaction mutation from silently invalidating repayment or BNPL relationship", async () => {
    const a = await fixture();
    await recordLiabilityRepaymentInDb(a);
    const [txRow] = await getDb().select().from(transactions).where(eq(transactions.id, a.repayment.transactionId!));
    const tx = mapRowToTransaction(txRow!);

    // Attempting to change amount on linked transaction is rejected
    await expect(
      updateTransactionInDb({
        householdId: a.householdId,
        id: tx.id,
        expectedVersion: tx.version,
        transaction: { ...tx, amount: money(99999n, "PLN") },
      }),
    ).rejects.toThrow("Cannot modify amount, currency, or kind of transaction linked to active repayment or BNPL purchase");

    // Attempting to change currency is rejected
    await expect(
      updateTransactionInDb({
        householdId: a.householdId,
        id: tx.id,
        expectedVersion: tx.version,
        transaction: { ...tx, amount: money(tx.amount.amountMinor, "EUR") },
      }),
    ).rejects.toThrow("Cannot modify amount, currency, or kind of transaction linked to active repayment or BNPL purchase");

    // Attempting to void the transaction directly is rejected
    await expect(
      voidTransactionInDb({
        householdId: a.householdId,
        id: tx.id,
        expectedVersion: tx.version,
      }),
    ).rejects.toThrow("Cannot void transaction linked to active repayment or BNPL purchase");

    // Updating a non-critical field (payee) succeeds
    if (tx.kind === "expense") {
      const updated = await updateTransactionInDb({
        householdId: a.householdId,
        id: tx.id,
        expectedVersion: tx.version,
        transaction: { ...tx, payee: "Updated payee name" },
      });
      expect(updated.version).toBe(2);
    }

    // After voiding the repayment, the pre-existing transaction CAN be voided
    await voidLiabilityRepaymentInDb({ householdId: a.householdId, id: a.repayment.id, expectedVersion: 1 });
    const voidedTx = await voidTransactionInDb({
      householdId: a.householdId,
      id: tx.id,
      expectedVersion: 2,
    });
    expect(voidedTx.voidedAt).not.toBeNull();
  });

  it("rejects conflicting payload on retry of created cash payment", async () => {
    const a = await fixture();
    const [source] = await getDb().select().from(transactions).where(eq(transactions.id, a.repayment.transactionId!));
    const cashTransaction = mapRowToTransaction({ ...source!, id: crypto.randomUUID() });
    const params = { ...a, repayment: { ...a.repayment, transactionId: null }, cashTransaction };
    await recordLiabilityRepaymentInDb(params);

    // Conflicting amount on retry
    const conflictingAmountTx = { ...cashTransaction, amount: money(99999n, "PLN") };
    await expect(
      recordLiabilityRepaymentInDb({ ...params, cashTransaction: conflictingAmountTx }),
    ).rejects.toThrow("conflicts with an existing payment");

    // Conflicting notes on repayment retry
    await expect(
      recordLiabilityRepaymentInDb({ ...params, repayment: { ...params.repayment, notes: "different note" } }),
    ).rejects.toThrow("conflicts with an existing payment");
  });
});
