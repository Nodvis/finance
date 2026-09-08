import { describe, expect, it } from "vitest";

import {
  accountId,
  createExpense,
  createIncome,
  householdId,
  money,
  personId,
  transactionId,
} from "./index";
import {
  findTransferCandidates,
  validateTransferMatch,
} from "./transfer-matching";

describe("transfer-matching domain logic", () => {
  const hId = householdId("11111111-1111-4111-8111-111111111111");
  const pId = personId("22222222-2222-4222-8222-222222222222");

  const accChecking = {
    id: accountId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    name: "mBank Checking",
    currency: "PLN",
  };
  const accSavings = {
    id: accountId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    name: "CA Savings",
    currency: "PLN",
  };
  const accEur = {
    id: accountId("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"),
    name: "Revolut EUR",
    currency: "EUR",
  };

  const IBAN_SAVINGS = "PL74109024020000000123456789";
  const IBAN_CHECKING = "PL57114020040000300201234567";

  const identifiers = [
    {
      accountId: accSavings.id,
      normalizedIdentifier: IBAN_SAVINGS,
    },
    {
      accountId: accChecking.id,
      normalizedIdentifier: IBAN_CHECKING,
    },
  ];

  it("marks confirmed identifier + compatible currency/amount/date as ready_auto", () => {
    const t1 = createExpense({
      id: transactionId("10000000-0000-4000-8000-000000000001"),
      householdId: hId,
      accountId: accChecking.id,
      amount: money(100000n, "PLN"), // 1000.00 PLN
      payee: `Przelew oszczednosciowy ${IBAN_SAVINGS}`,
      paidByPersonId: pId,
      occurredOn: new Date("2026-09-01T10:00:00Z"),
    });

    const t2 = createIncome({
      id: transactionId("20000000-0000-4000-8000-000000000002"),
      householdId: hId,
      accountId: accSavings.id,
      amount: money(100000n, "PLN"), // 1000.00 PLN
      source: "Zasilenie konta",
      receivedByPersonId: pId,
      occurredOn: new Date("2026-09-01T11:00:00Z"),
    });

    const candidates = findTransferCandidates({
      transactions: [t1, t2],
      accounts: [accChecking, accSavings],
      identifiers,
    });

    expect(candidates).toHaveLength(1);
    const c = candidates[0]!;
    expect(c.confidence).toBe("ready_auto");
    expect(c.fromAccountId).toBe(accChecking.id);
    expect(c.toAccountId).toBe(accSavings.id);
    expect(c.amountMinor).toBe(100000n);
    expect(c.currency).toBe("PLN");
    expect(c.evidence.matchedIdentifier).toBe(IBAN_SAVINGS);
    expect(c.evidence.matchedRelationshipType).toBe("known_account_identifier");
    expect(c.evidence.crossCurrency).toBe(false);

    const validation = validateTransferMatch(c);
    expect(validation.valid).toBe(true);
  });

  it("classifies similar amount and date ALONE as review_only (never ready_auto)", () => {
    // Both accounts in household, same amount, same date, but NO account identifier in payee/source
    const t1 = createExpense({
      id: transactionId("10000000-0000-4000-8000-000000000011"),
      householdId: hId,
      accountId: accChecking.id,
      amount: money(25000n, "PLN"), // 250.00 PLN
      payee: "Przelew wlasny", // No IBAN
      paidByPersonId: pId,
      occurredOn: new Date("2026-09-02T10:00:00Z"),
    });

    const t2 = createIncome({
      id: transactionId("20000000-0000-4000-8000-000000000012"),
      householdId: hId,
      accountId: accSavings.id,
      amount: money(25000n, "PLN"), // 250.00 PLN
      source: "Wplata",
      receivedByPersonId: pId,
      occurredOn: new Date("2026-09-02T10:30:00Z"),
    });

    const candidates = findTransferCandidates({
      transactions: [t1, t2],
      accounts: [accChecking, accSavings],
      identifiers,
    });

    expect(candidates).toHaveLength(1);
    const c = candidates[0]!;
    expect(c.confidence).toBe("review_only");
    expect(c.evidence.matchedRelationshipType).toBe("amount_date_heuristic");
    expect(c.evidence.uncertaintyReasons).toContain(
      "SIMILAR_AMOUNT_DATE_NO_IDENTIFIER",
    );
  });

  it("identifies one_sided_pending when target identifier exists but counterpart has not arrived", () => {
    const t1 = createExpense({
      id: transactionId("10000000-0000-4000-8000-000000000021"),
      householdId: hId,
      accountId: accChecking.id,
      amount: money(50000n, "PLN"), // 500.00 PLN
      payee: `Przelew na CA: ${IBAN_SAVINGS}`,
      paidByPersonId: pId,
      occurredOn: new Date("2026-09-03T10:00:00Z"),
    });

    // No income on accSavings!
    const candidates = findTransferCandidates({
      transactions: [t1],
      accounts: [accChecking, accSavings],
      identifiers,
    });

    expect(candidates).toHaveLength(1);
    const c = candidates[0]!;
    expect(c.confidence).toBe("one_sided_pending");
    expect(c.outflow).not.toBeNull();
    expect(c.inflow).toBeNull();
    expect(c.toAccountId).toBe(accSavings.id);
    expect(c.evidence.uncertaintyReasons).toContain(
      "AWAITING_COUNTERPART_INFLOW",
    );

    // Matching validation should fail for one-sided candidate
    const validation = validateTransferMatch(c);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("both outflow and inflow");
  });

  it("marks cross-currency transfer candidates as ambiguous", () => {
    const t1 = createExpense({
      id: transactionId("10000000-0000-4000-8000-000000000031"),
      householdId: hId,
      accountId: accEur.id,
      amount: money(10000n, "EUR"), // 100.00 EUR
      payee: `Przelew walutowy ${IBAN_CHECKING}`,
      paidByPersonId: pId,
      occurredOn: new Date("2026-09-04T10:00:00Z"),
    });

    const t2 = createIncome({
      id: transactionId("20000000-0000-4000-8000-000000000032"),
      householdId: hId,
      accountId: accChecking.id,
      amount: money(43000n, "PLN"), // 430.00 PLN
      source: "Wplyw walutowy",
      receivedByPersonId: pId,
      occurredOn: new Date("2026-09-04T12:00:00Z"),
    });

    const candidates = findTransferCandidates({
      transactions: [t1, t2],
      accounts: [accEur, accChecking],
      identifiers,
    });

    expect(candidates).toHaveLength(1);
    const c = candidates[0]!;
    expect(c.confidence).toBe("ambiguous");
    expect(c.evidence.crossCurrency).toBe(true);
    expect(c.evidence.uncertaintyReasons).toContain(
      "CROSS_CURRENCY_UNCERTAINTY",
    );
  });

  it("marks multiple matching counterparts as ambiguous", () => {
    const t1 = createExpense({
      id: transactionId("10000000-0000-4000-8000-000000000041"),
      householdId: hId,
      accountId: accChecking.id,
      amount: money(10000n, "PLN"),
      payee: `Przelew ${IBAN_SAVINGS}`,
      paidByPersonId: pId,
      occurredOn: new Date("2026-09-05T10:00:00Z"),
    });

    // Two identical deposits on savings on the same day
    const t2a = createIncome({
      id: transactionId("20000000-0000-4000-8000-000000000042"),
      householdId: hId,
      accountId: accSavings.id,
      amount: money(10000n, "PLN"),
      source: "Wplata 1",
      receivedByPersonId: pId,
      occurredOn: new Date("2026-09-05T11:00:00Z"),
    });
    const t2b = createIncome({
      id: transactionId("20000000-0000-4000-8000-000000000043"),
      householdId: hId,
      accountId: accSavings.id,
      amount: money(10000n, "PLN"),
      source: "Wplata 2",
      receivedByPersonId: pId,
      occurredOn: new Date("2026-09-05T12:00:00Z"),
    });

    const candidates = findTransferCandidates({
      transactions: [t1, t2a, t2b],
      accounts: [accChecking, accSavings],
      identifiers,
    });

    expect(candidates).toHaveLength(1);
    const c = candidates[0]!;
    expect(c.confidence).toBe("ambiguous");
    expect(c.evidence.uncertaintyReasons).toContain(
      "MULTIPLE_COUNTERPARTS_FOUND",
    );
  });

  it("rejects matching when accounts are identical", () => {
    const invalidCandidate = {
      id: "test",
      confidence: "ready_auto" as const,
      fromAccountId: accChecking.id,
      toAccountId: accChecking.id, // SAME!
      outflow: {
        transactionId: transactionId("10000000-0000-4000-8000-000000000051"),
        accountId: accChecking.id,
        amountMinor: 5000n,
        currency: "PLN",
        occurredOn: new Date(),
        kind: "expense" as const,
        counterpartyText: "self",
        version: 1,
      },
      inflow: {
        transactionId: transactionId("20000000-0000-4000-8000-000000000052"),
        accountId: accChecking.id,
        amountMinor: 5000n,
        currency: "PLN",
        occurredOn: new Date(),
        kind: "income" as const,
        counterpartyText: "self",
        version: 1,
      },
      amountMinor: 5000n,
      currency: "PLN",
      evidence: {
        matchedRelationshipType: "known_account_identifier" as const,
        dateDifferenceDays: 0,
        crossCurrency: false,
        uncertaintyReasons: [],
      },
    };

    const validation = validateTransferMatch(invalidCandidate);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("identical accounts");
  });
});
