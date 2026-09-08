import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import {
  accountId,
  createExpense,
  createIncome,
  householdId,
  money,
  personId,
  transactionId,
} from "@nodvis/finance-domain";

import { getDb } from "../client";
import { accounts, householdMemberships, households, persons } from "../schema/foundation";
import { transactionAuditEntries, transactions } from "../schema/transactions";
import { transferMatches } from "../schema/transfer-matches";
import {
  executeTransferMatch,
  InvalidTransferMatchError,
  listTransferMatchesByHousehold,
} from "./transfer-matching";
import {
  insertTransaction,
  listTransactionAuditEntries,
  TransactionAlreadyVoidedError,
  TransactionVersionConflictError,
} from "./transactions";

const testDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(testDir, "../../../../.env") });

describe("transfer-matching database access integration", () => {
  const isPostgresAvailable = Boolean(process.env.DATABASE_URL);

  it.runIf(isPostgresAvailable)(
    "reconciles an outflow and inflow into one logical transfer with audit immutability and optimistic concurrency",
    async () => {
      const db = getDb();
      const hId = crypto.randomUUID();
      const pId = crypto.randomUUID();
      const accOutId = crypto.randomUUID();
      const accInId = crypto.randomUUID();

      // Seed household and accounts
      await db.insert(households).values({
        id: hId,
        name: "Household Transfers",
        defaultCurrency: "PLN",
      });

      await db.insert(persons).values({
        id: pId,
        displayName: "Eryk",
      });

      await db.insert(householdMemberships).values({
        householdId: hId,
        personId: pId,
      });

      await db.insert(accounts).values([
        {
          id: accOutId,
          householdId: hId,
          name: "mBank Outflow",
          type: "checking",
          currency: "PLN",
        },
        {
          id: accInId,
          householdId: hId,
          name: "CA Inflow",
          type: "savings",
          currency: "PLN",
        },
      ]);

      // Seed outflow expense
      const expense = createExpense({
        id: transactionId(crypto.randomUUID()),
        householdId: householdId(hId),
        accountId: accountId(accOutId),
        amount: money(75000n, "PLN"), // 750.00 PLN
        payee: "Przelew na CA: PL74109024020000000123456789",
        paidByPersonId: personId(pId),
        occurredOn: new Date("2026-09-08T10:00:00Z"),
      });
      const savedExpense = await insertTransaction(expense);

      // Seed inflow income
      const income = createIncome({
        id: transactionId(crypto.randomUUID()),
        householdId: householdId(hId),
        accountId: accountId(accInId),
        amount: money(75000n, "PLN"), // 750.00 PLN
        source: "Wplata z mBank",
        receivedByPersonId: personId(pId),
        occurredOn: new Date("2026-09-08T11:00:00Z"),
      });
      const savedIncome = await insertTransaction(income);

      // Execute transfer match
      const result = await executeTransferMatch({
        householdId: hId,
        outflowTransactionId: savedExpense.id,
        expectedOutflowVersion: savedExpense.version,
        inflowTransactionId: savedIncome.id,
        expectedInflowVersion: savedIncome.version,
        matchedIdentifier: "PL74109024020000000123456789",
        matchConfidence: "automatic",
      });

      // 1. One logical transfer entity
      expect(result.transfer.kind).toBe("transfer");
      if (result.transfer.kind === "transfer") {
        expect(result.transfer.fromAccountId).toBe(accOutId);
        expect(result.transfer.toAccountId).toBe(accInId);
        expect(result.transfer.amount.amountMinor).toBe(75000n);
        expect(result.transfer.voidedAt).toBeNull();
      }

      // 2. Transfer match record
      expect(result.match.transferTransactionId).toBe(savedExpense.id);
      expect(result.match.matchedTransactionId).toBe(savedIncome.id);
      expect(result.match.matchConfidence).toBe("automatic");
      expect(result.match.matchedIdentifier).toBe(
        "PL74109024020000000123456789",
      );

      // 3. Verify counterpart inflow is voided
      const [inflowDb] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, savedIncome.id));
      expect(inflowDb?.voidedAt).not.toBeNull();
      expect(inflowDb?.voidReason).toContain(savedExpense.id);

      // 4. Verify audit entries for both transactions
      const expenseAudits = await listTransactionAuditEntries(
        hId,
        savedExpense.id,
      );
      expect(expenseAudits).toHaveLength(2); // create, then correction (to transfer)
      expect(expenseAudits[1]!.operation).toBe("correction");

      const incomeAudits = await listTransactionAuditEntries(
        hId,
        savedIncome.id,
      );
      expect(incomeAudits).toHaveLength(2); // create, then void
      expect(incomeAudits[1]!.operation).toBe("void");

      // 5. Query transfer matches by household
      const matches = await listTransferMatchesByHousehold(hId);
      expect(matches).toHaveLength(1);
      expect(matches[0]!.id).toBe(result.match.id);

      // 6. Optimistic concurrency check: attempting to match already transformed/voided transactions
      await expect(
        executeTransferMatch({
          householdId: hId,
          outflowTransactionId: savedExpense.id,
          expectedOutflowVersion: savedExpense.version, // Old version
          inflowTransactionId: savedIncome.id,
          expectedInflowVersion: savedIncome.version,
        }),
      ).rejects.toThrow(TransactionVersionConflictError);
    },
  );

  it.runIf(isPostgresAvailable)(
    "rejects matching transactions on the same account",
    async () => {
      const db = getDb();
      const hId = crypto.randomUUID();
      const pId = crypto.randomUUID();
      const accId = crypto.randomUUID();

      await db.insert(households).values({
        id: hId,
        name: "Same Acc Household",
        defaultCurrency: "PLN",
      });
      await db.insert(persons).values({
        id: pId,
        displayName: "Jan",
      });
      await db.insert(householdMemberships).values({
        householdId: hId,
        personId: pId,
      });
      await db.insert(accounts).values({
        id: accId,
        householdId: hId,
        name: "Single Acc",
        type: "checking",
        currency: "PLN",
      });

      const exp = await insertTransaction(
        createExpense({
          id: transactionId(crypto.randomUUID()),
          householdId: householdId(hId),
          accountId: accountId(accId),
          amount: money(1000n, "PLN"),
          payee: "Test Out",
          paidByPersonId: personId(pId),
          occurredOn: new Date(),
        }),
      );

      const inc = await insertTransaction(
        createIncome({
          id: transactionId(crypto.randomUUID()),
          householdId: householdId(hId),
          accountId: accountId(accId),
          amount: money(1000n, "PLN"),
          source: "Test In",
          receivedByPersonId: personId(pId),
          occurredOn: new Date(),
        }),
      );

      await expect(
        executeTransferMatch({
          householdId: hId,
          outflowTransactionId: exp.id,
          expectedOutflowVersion: exp.version,
          inflowTransactionId: inc.id,
          expectedInflowVersion: inc.version,
        }),
      ).rejects.toThrow(InvalidTransferMatchError);
    },
  );
});
