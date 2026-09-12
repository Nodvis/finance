import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { getDb } from "../client";
import { accounts, households, persons, householdMemberships } from "../schema/foundation";
import { liabilities } from "../schema/liabilities";
import {
  listBalanceObservationsForSubject,
  listHouseholdBalanceObservations,
  listLatestBalanceObservations,
  recordAccountBalanceObservation,
  recordLiabilityBalanceObservation,
} from "./balance-observations";
import { AccountNotFoundError } from "./accounts";
import { LiabilityNotFoundError } from "./liabilities";

const testDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(testDir, "../../../../.env") });

describe("PostgreSQL balance observation access tests", () => {
  const isPostgresAvailable = Boolean(process.env.DATABASE_URL);

  it.runIf(isPostgresAvailable)(
    "records account balance observations and keeps account snapshot synchronized",
    async () => {
      const db = getDb();
      const householdId = crypto.randomUUID();
      const accountId = crypto.randomUUID();

      await db.insert(households).values({
        id: householdId,
        name: "Observation Test Household",
        defaultCurrency: "PLN",
      });

      await db.insert(accounts).values({
        id: accountId,
        householdId,
        name: "Test Checking",
        type: "checking",
        currency: "PLN",
        balanceSnapshotMinor: 100_000n,
        balanceSnapshotAt: new Date("2026-08-01T10:00:00Z"),
      });

      // Record an observation that is newer
      const obs1 = await recordAccountBalanceObservation({
        householdId,
        accountId,
        amountMinor: 150_000n,
        currency: "PLN",
        observedAt: new Date("2026-08-15T12:00:00Z"),
        note: "Mid-month check",
      });

      expect(obs1.accountId).toBe(accountId);
      expect(obs1.amountMinor).toBe(150_000n);
      expect(obs1.currency).toBe("PLN");
      expect(obs1.source).toBe("manual");
      expect(obs1.note).toBe("Mid-month check");

      // Verify the account snapshot in the database was updated
      const [updatedAcc] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));
      expect(updatedAcc?.balanceSnapshotMinor).toBe(150_000n);
      expect(updatedAcc?.balanceSnapshotAt?.toISOString()).toBe(new Date("2026-08-15T12:00:00Z").toISOString());

      // Verify listing for subject
      const subjectObs = await listBalanceObservationsForSubject({
        householdId,
        accountId,
      });
      expect(subjectObs.some((o) => o.id === obs1.id)).toBe(true);
    },
  );

  it.runIf(isPostgresAvailable)(
    "records liability balance observations and enforces non-negative debt amounts",
    async () => {
      const db = getDb();
      const householdId = crypto.randomUUID();
      const liabilityId = crypto.randomUUID();

      await db.insert(households).values({
        id: householdId,
        name: "Liability Obs Household",
        defaultCurrency: "PLN",
      });

      await db.insert(liabilities).values({
        id: liabilityId,
        householdId,
        name: "Auto Loan",
        kind: "loan",
        currency: "PLN",
        observedOutstandingMinor: 500_000n,
        observedOutstandingAt: new Date("2026-08-01T10:00:00Z"),
      });

      const obs = await recordLiabilityBalanceObservation({
        householdId,
        liabilityId,
        amountMinor: 480_000n,
        currency: "PLN",
        observedAt: new Date("2026-08-15T12:00:00Z"),
        note: "Principal reduced",
      });

      expect(obs.liabilityId).toBe(liabilityId);
      expect(obs.amountMinor).toBe(480_000n);
      expect(obs.subjectKind).toBe("liability");

      // Negative liability balance observation must be rejected
      await expect(
        recordLiabilityBalanceObservation({
          householdId,
          liabilityId,
          amountMinor: -100n,
          currency: "PLN",
          observedAt: new Date("2026-08-20T12:00:00Z"),
        }),
      ).rejects.toThrow("Liability balance observation cannot be negative");
    },
  );

  it.runIf(isPostgresAvailable)(
    "strictly enforces household isolation for account and liability observations",
    async () => {
      const db = getDb();
      const householdA = crypto.randomUUID();
      const householdB = crypto.randomUUID();
      const accountA = crypto.randomUUID();
      const liabilityA = crypto.randomUUID();

      await db.insert(households).values([
        { id: householdA, name: "Household A", defaultCurrency: "PLN" },
        { id: householdB, name: "Household B", defaultCurrency: "PLN" },
      ]);

      await db.insert(accounts).values({
        id: accountA,
        householdId: householdA,
        name: "A Checking",
        type: "checking",
        currency: "PLN",
      });

      await db.insert(liabilities).values({
        id: liabilityA,
        householdId: householdA,
        name: "A Loan",
        kind: "loan",
        currency: "PLN",
      });

      // Attempting to record an observation for household B using household A's account
      await expect(
        recordAccountBalanceObservation({
          householdId: householdB,
          accountId: accountA,
          amountMinor: 50_000n,
          currency: "PLN",
          observedAt: new Date(),
        }),
      ).rejects.toThrow(AccountNotFoundError);

      // Attempting to record an observation for household B using household A's liability
      await expect(
        recordLiabilityBalanceObservation({
          householdId: householdB,
          liabilityId: liabilityA,
          amountMinor: 50_000n,
          currency: "PLN",
          observedAt: new Date(),
        }),
      ).rejects.toThrow(LiabilityNotFoundError);

      // Attempting to list observations for subject across households
      await expect(
        listBalanceObservationsForSubject({
          householdId: householdB,
          accountId: accountA,
        }),
      ).rejects.toThrow(AccountNotFoundError);
    },
  );

  it.runIf(isPostgresAvailable)(
    "rejects currency mismatch between subject and observation",
    async () => {
      const db = getDb();
      const householdId = crypto.randomUUID();
      const accountId = crypto.randomUUID();

      await db.insert(households).values({
        id: householdId,
        name: "Currency Test Household",
        defaultCurrency: "PLN",
      });

      await db.insert(accounts).values({
        id: accountId,
        householdId,
        name: "PLN Savings",
        type: "savings",
        currency: "PLN",
      });

      await expect(
        recordAccountBalanceObservation({
          householdId,
          accountId,
          amountMinor: 10_000n,
          currency: "EUR", // mismatch!
          observedAt: new Date(),
        }),
      ).rejects.toThrow("Currency mismatch");
    },
  );

  it.runIf(isPostgresAvailable)(
    "lists latest observations per subject as of a specific date",
    async () => {
      const db = getDb();
      const householdId = crypto.randomUUID();
      const account1 = crypto.randomUUID();
      const account2 = crypto.randomUUID();

      await db.insert(households).values({
        id: householdId,
        name: "Latest Obs Household",
        defaultCurrency: "PLN",
      });

      await db.insert(accounts).values([
        { id: account1, householdId, name: "Acc 1", type: "checking", currency: "PLN" },
        { id: account2, householdId, name: "Acc 2", type: "savings", currency: "PLN" },
      ]);

      // Observations for acc1 at T1 and T3
      await recordAccountBalanceObservation({
        householdId,
        accountId: account1,
        amountMinor: 100_000n,
        currency: "PLN",
        observedAt: new Date("2026-08-01T12:00:00Z"),
      });
      await recordAccountBalanceObservation({
        householdId,
        accountId: account1,
        amountMinor: 120_000n,
        currency: "PLN",
        observedAt: new Date("2026-09-01T12:00:00Z"),
      });

      // Observation for acc2 at T2
      await recordAccountBalanceObservation({
        householdId,
        accountId: account2,
        amountMinor: 200_000n,
        currency: "PLN",
        observedAt: new Date("2026-08-15T12:00:00Z"),
      });

      // asOf = 2026-08-20: acc1 should have 100_000n, acc2 should have 200_000n
      const latestAtAug20 = await listLatestBalanceObservations(
        householdId,
        new Date("2026-08-20T23:59:59Z"),
      );
      const acc1Obs = latestAtAug20.find((o) => o.accountId === account1);
      const acc2Obs = latestAtAug20.find((o) => o.accountId === account2);

      expect(acc1Obs?.amountMinor).toBe(100_000n);
      expect(acc2Obs?.amountMinor).toBe(200_000n);

      // asOf = 2026-09-05: acc1 should have 120_000n
      const latestAtSep = await listLatestBalanceObservations(
        householdId,
        new Date("2026-09-05T23:59:59Z"),
      );
      const acc1Sep = latestAtSep.find((o) => o.accountId === account1);
      expect(acc1Sep?.amountMinor).toBe(120_000n);
    },
  );
});
