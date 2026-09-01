import { describe, expect, expectTypeOf, it } from "vitest";

import {
  accountId,
  accountType,
  contributesToAvailableCash,
  createAccount,
  createHousehold,
  createPerson,
  householdId,
  householdMembership,
  money,
  personId,
} from "./index";

const householdUuid = "018f47a0-7762-7b9c-8d17-27f2f79e59a1";
const personUuid = "018f47a0-7762-7b9c-8d17-27f2f79e59a2";
const accountUuid = "018f47a0-7762-7b9c-8d17-27f2f79e59a3";

describe("core financial foundation", () => {
  it("keeps Household and Person as distinct domain concepts", () => {
    const household = createHousehold({
      id: householdId(householdUuid),
      name: "  Home  ",
      defaultCurrency: "pln",
    });
    const person = createPerson({
      id: personId(personUuid),
      displayName: "  Eryk  ",
    });

    expect(household).toEqual({
      id: householdUuid,
      name: "Home",
      defaultCurrency: "PLN",
    });
    expect(person).toEqual({ id: personUuid, displayName: "Eryk" });
    expectTypeOf(person.id).not.toEqualTypeOf(household.id);
  });

  it("represents membership independently from account ownership", () => {
    const membership = householdMembership(
      householdId(householdUuid),
      personId(personUuid),
    );

    expect(membership).toEqual({
      householdId: householdUuid,
      personId: personUuid,
    });
    expect(membership).not.toHaveProperty("accountId");
  });

  it("rejects malformed persistence identifiers", () => {
    expect(() => householdId("not-a-uuid")).toThrow(/Invalid household id/);
    expect(() => personId("not-a-uuid")).toThrow(/Invalid person id/);
    expect(() => accountId("not-a-uuid")).toThrow(/Invalid account id/);
  });

  it("rejects account types outside the current phase", () => {
    expect(accountType("checking")).toBe("checking");
    expect(() => accountType("investment")).toThrow(/Invalid account type/);
  });

  it("requires owners and removes duplicate ownership entries", () => {
    const ownerId = personId(personUuid);
    const account = createAccount({
      id: accountId(accountUuid),
      householdId: householdId(householdUuid),
      name: "Main account",
      type: "checking",
      currency: "PLN",
      ownerPersonIds: [ownerId, ownerId],
    });

    expect(account.ownerPersonIds).toEqual([ownerId]);
    expect(() =>
      createAccount({
        id: accountId(accountUuid),
        householdId: householdId(householdUuid),
        name: "Unowned",
        type: "checking",
        currency: "PLN",
        ownerPersonIds: [],
      }),
    ).toThrow(/at least one owner/);
  });

  it("requires a balance snapshot to use the account currency", () => {
    expect(() =>
      createAccount({
        id: accountId(accountUuid),
        householdId: householdId(householdUuid),
        name: "EUR savings",
        type: "savings",
        currency: "EUR",
        ownerPersonIds: [personId(personUuid)],
        balanceSnapshot: {
          balance: money(10_000n, "PLN"),
          capturedAt: new Date("2026-09-01T08:00:00Z"),
        },
      }),
    ).toThrow(/currency mismatch/);
  });

  it("does not treat credit-card capacity as available cash", () => {
    expect(contributesToAvailableCash("checking")).toBe(true);
    expect(contributesToAvailableCash("savings")).toBe(true);
    expect(contributesToAvailableCash("cash")).toBe(true);
    expect(contributesToAvailableCash("credit_card")).toBe(false);
  });

  it("supports signed balance snapshots for overdrafts and credit card liabilities", () => {
    const owner = personId(personUuid);
    const capturedAt = new Date("2026-09-01T12:00:00Z");

    const overdraftChecking = createAccount({
      id: accountId(accountUuid),
      householdId: householdId(householdUuid),
      name: "Overdrawn checking",
      type: "checking",
      currency: "PLN",
      ownerPersonIds: [owner],
      balanceSnapshot: {
        balance: money(-5000n, "PLN"), // -50.00 PLN overdraft
        capturedAt,
      },
    });

    const cardWithDebt = createAccount({
      id: accountId(accountUuid),
      householdId: householdId(householdUuid),
      name: "Visa Credit Card",
      type: "credit_card",
      currency: "PLN",
      ownerPersonIds: [owner],
      balanceSnapshot: {
        balance: money(-25000n, "PLN"), // -250.00 PLN owed
        capturedAt,
      },
    });

    const cardOverpaid = createAccount({
      id: accountId(accountUuid),
      householdId: householdId(householdUuid),
      name: "Mastercard Overpaid",
      type: "credit_card",
      currency: "PLN",
      ownerPersonIds: [owner],
      balanceSnapshot: {
        balance: money(5000n, "PLN"), // +50.00 PLN credit
        capturedAt,
      },
    });

    expect(overdraftChecking.balanceSnapshot?.balance.amountMinor).toBe(-5000n);
    expect(cardWithDebt.balanceSnapshot?.balance.amountMinor).toBe(-25000n);
    expect(cardOverpaid.balanceSnapshot?.balance.amountMinor).toBe(5000n);
  });

  it("allows a single Person to belong to multiple Households", () => {
    const person = createPerson({
      id: personId(personUuid),
      displayName: "Eryk",
    });
    const secondHouseholdUuid = "018f47a0-7762-7b9c-8d17-27f2f79e59a4";

    const membership1 = householdMembership(
      householdId(householdUuid),
      person.id,
    );
    const membership2 = householdMembership(
      householdId(secondHouseholdUuid),
      person.id,
    );

    expect(membership1.householdId).toBe(householdUuid);
    expect(membership2.householdId).toBe(secondHouseholdUuid);
    expect(membership1.personId).toBe(person.id);
    expect(membership2.personId).toBe(person.id);
  });

  it("rejects blank or oversized names for entities", () => {
    const validHouseholdId = householdId(householdUuid);
    const validPersonId = personId(personUuid);
    const longName = "A".repeat(161);

    expect(() =>
      createHousehold({
        id: validHouseholdId,
        name: "   ",
        defaultCurrency: "PLN",
      }),
    ).toThrow(/Invalid household name/);
    expect(() =>
      createHousehold({
        id: validHouseholdId,
        name: longName,
        defaultCurrency: "PLN",
      }),
    ).toThrow(/Invalid household name/);

    expect(() =>
      createPerson({
        id: validPersonId,
        displayName: "   ",
      }),
    ).toThrow(/Invalid person name/);
    expect(() =>
      createPerson({
        id: validPersonId,
        displayName: longName,
      }),
    ).toThrow(/Invalid person name/);

    expect(() =>
      createAccount({
        id: accountId(accountUuid),
        householdId: validHouseholdId,
        name: "   ",
        type: "checking",
        currency: "PLN",
        ownerPersonIds: [validPersonId],
      }),
    ).toThrow(/Invalid account name/);
  });
});
