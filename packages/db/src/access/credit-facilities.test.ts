import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "../client";
import { accounts, households } from "../schema/foundation";
import {
  CreditFacilityAccountError,
  createCreditFacility,
  findCreditFacilityForAccount,
  listCreditFacilitiesByHousehold,
} from "./credit-facilities";
import { createHouseholdAccount } from "./accounts";

const testDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(testDir, "../../../../.env") });

const isPostgresAvailable = Boolean(process.env.DATABASE_URL);

describe("credit facility database access integration", () => {
  it.runIf(isPostgresAvailable)("preserves exact limits and household scope", async () => {
    const db = getDb();
    const householdA = crypto.randomUUID();
    const householdB = crypto.randomUUID();
    const accountA = crypto.randomUUID();
    const massiveLimit = 15_000_000_000_000_000n;

    await db.insert(households).values([
      { id: householdA, name: "Facility A", defaultCurrency: "PLN" },
      { id: householdB, name: "Facility B", defaultCurrency: "PLN" },
    ]);
    await db.insert(accounts).values({
      id: accountA,
      householdId: householdA,
      name: "Checking A",
      type: "checking",
      currency: "PLN",
      balanceSnapshotMinor: 300000n,
      balanceSnapshotAt: new Date("2026-09-09T10:00:00Z"),
    });

    const created = await createCreditFacility({
      householdId: householdA,
      accountId: accountA,
      kind: "overdraft",
      name: "Agreed overdraft",
      currency: "PLN",
      approvedLimitMinor: massiveLimit,
      observedUsedMinor: 0n,
      observedAvailableMinor: massiveLimit,
      observedAt: new Date("2026-09-09T10:00:00Z"),
    });

    expect(created.approvedLimitMinor).toBe(massiveLimit);
    expect((await findCreditFacilityForAccount(householdA, accountA))?.accountId).toBe(accountA);
    expect(await listCreditFacilitiesByHousehold(householdB)).toHaveLength(0);
  });

  it.runIf(isPostgresAvailable)("rejects overdrafts on another household or non-checking account", async () => {
    const db = getDb();
    const householdId = crypto.randomUUID();
    const savingsId = crypto.randomUUID();
    await db.insert(households).values({ id: householdId, name: "Invalid Facility", defaultCurrency: "PLN" });
    await db.insert(accounts).values({ id: savingsId, householdId, name: "Savings", type: "savings", currency: "PLN" });

    await expect(createCreditFacility({
      householdId,
      accountId: savingsId,
      kind: "overdraft",
      name: "Invalid overdraft",
      currency: "PLN",
      approvedLimitMinor: 200000n,
    })).rejects.toThrow(CreditFacilityAccountError);
  });

  it.runIf(isPostgresAvailable)("creates an account and overdraft atomically", async () => {
    const db = getDb();
    const householdId = crypto.randomUUID();
    const personId = crypto.randomUUID();
    await db.insert(households).values({ id: householdId, name: "Atomic Facility", defaultCurrency: "PLN" });
    const { persons, householdMemberships } = await import("../schema/foundation");
    await db.insert(persons).values({ id: personId, displayName: "Atomic User" });
    await db.insert(householdMemberships).values({ householdId, personId });

    const account = await createHouseholdAccount({
      householdId,
      name: "Checking with overdraft",
      type: "checking",
      currency: "PLN",
      ownerPersonIds: [personId],
      balanceSnapshotMinor: 300000n,
      overdraft: { name: "Overdraft facility", approvedLimitMinor: 200000n },
    });
    expect((await findCreditFacilityForAccount(householdId, account.id))?.approvedLimitMinor).toBe(200000n);

    await expect(createHouseholdAccount({
      householdId,
      name: "Invalid savings overdraft",
      type: "savings",
      currency: "PLN",
      ownerPersonIds: [personId],
      overdraft: { name: "Should rollback", approvedLimitMinor: 100n },
    })).rejects.toThrow("checking account");
    expect((await db.select().from(accounts).where(and(eq(accounts.householdId, householdId), eq(accounts.name, "Invalid savings overdraft")))).length).toBe(0);
  });
});
