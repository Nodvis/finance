import "server-only";

import {
  LiabilityDestinationAccountCurrencyMismatchError,
  LiabilityDestinationAccountInvalidHouseholdError,
  LiabilityDestinationAccountNotFoundError,
  LiabilityNotFoundError,
  LiabilityRepaymentAlreadyVoidedError,
  LiabilityRepaymentNotFoundError,
  LiabilityRepaymentVersionConflictError,
  LiabilityVersionConflictError,
  archiveLiabilityInDb,
  findAccountInHousehold,
  findLiabilityById,
  findLiabilityRepaymentById,
  insertLiabilityInDb,
  isPersonInHousehold,
  listLiabilitiesByHousehold,
  listLiabilityRepaymentsByHousehold,
  recordLiabilityRepaymentInDb,
  unarchiveLiabilityInDb,
  updateLiabilityInDb,
  voidLiabilityRepaymentInDb,
} from "@nodvis/finance-db";
import type { HouseholdLiabilitySummary } from "@nodvis/finance-db";
import {
  accountId as toAccountId,
  createExpense,
  createLiability,
  createLiabilityRepayment,
  createTransfer,
  currencyCode,
  householdId as toHouseholdId,
  liabilityId as toLiabilityId,
  liabilityRepaymentId as toLiabilityRepaymentId,
  money,
  personId as toPersonId,
  transactionId as toTransactionId,
  updateLiability,
} from "@nodvis/finance-domain";
import type {
  LiabilityRepayment,
  Transaction,
} from "@nodvis/finance-domain";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import { parseNaturalDecimalToMinor } from "@/lib/transactions/money-entry";
import type {
  ArchiveLiabilityInput,
  CreateLiabilityInput,
  CreateLiabilityRepaymentInput,
  ListLiabilitiesQuery,
  ListLiabilityRepaymentsQuery,
  UnarchiveLiabilityInput,
  UpdateLiabilityInput,
  VoidLiabilityRepaymentInput,
} from "./schema";

export {
  LiabilityDestinationAccountCurrencyMismatchError,
  LiabilityDestinationAccountInvalidHouseholdError,
  LiabilityDestinationAccountNotFoundError,
  LiabilityNotFoundError,
  LiabilityRepaymentAlreadyVoidedError,
  LiabilityRepaymentNotFoundError,
  LiabilityRepaymentVersionConflictError,
  LiabilityVersionConflictError,
};

export class LiabilityInvalidResponsiblePersonError extends Error {
  constructor(message: string = "Responsible person is not a member of this household") {
    super(message);
    this.name = "LiabilityInvalidResponsiblePersonError";
  }
}

export class LiabilityRepaymentSourceAccountNotFoundError extends Error {
  constructor(message: string = "Payment source account not found in household") {
    super(message);
    this.name = "LiabilityRepaymentSourceAccountNotFoundError";
  }
}

export class LiabilityRepaymentSourceAccountCurrencyMismatchError extends Error {
  constructor(message: string = "Payment source account currency must match liability currency") {
    super(message);
    this.name = "LiabilityRepaymentSourceAccountCurrencyMismatchError";
  }
}

export class LiabilityRepaymentInvalidAllocationError extends Error {
  constructor(message: string = "Invalid repayment allocation") {
    super(message);
    this.name = "LiabilityRepaymentInvalidAllocationError";
  }
}

export type HouseholdContext =
  | AuthorizedHouseholdUserContext
  | {
      authUserId?: string;
      householdId: string;
      personId?: string;
    };

function parseOptionalMoneyField(
  naturalValue: string | null | undefined,
  minorValue: string | null | undefined,
  currency: string,
): bigint | null {
  if (naturalValue !== undefined && naturalValue !== null && naturalValue.trim() !== "") {
    const res = parseNaturalDecimalToMinor(naturalValue, currency);
    if (!res.success || !res.amountMinor) {
      throw new Error(`Invalid money format for ${currency}: ${naturalValue}`);
    }
    return BigInt(res.amountMinor);
  }

  if (minorValue !== undefined && minorValue !== null && minorValue.trim() !== "") {
    return BigInt(minorValue);
  }

  return null;
}

export async function listHouseholdLiabilities(
  context: HouseholdContext,
  query?: ListLiabilitiesQuery,
): Promise<HouseholdLiabilitySummary[]> {
  const options = {
    includeArchived: query?.includeArchived ?? true,
  };
  return await listLiabilitiesByHousehold(context.householdId, options);
}

export async function getHouseholdLiability(
  context: HouseholdContext,
  liabilityId: string,
): Promise<HouseholdLiabilitySummary> {
  const liability = await findLiabilityById(context.householdId, liabilityId);
  if (!liability) {
    throw new LiabilityNotFoundError();
  }
  return liability;
}

export async function createHouseholdLiabilityEntry(
  context: HouseholdContext,
  input: CreateLiabilityInput,
): Promise<HouseholdLiabilitySummary> {
  const normalizedCurrency = currencyCode(input.currency);

  // Validate responsible person if provided
  if (input.responsiblePersonId) {
    const isMember = await isPersonInHousehold(
      context.householdId,
      input.responsiblePersonId,
    );
    if (!isMember) {
      throw new LiabilityInvalidResponsiblePersonError();
    }
  }

  // Validate destination account if provided
  if (input.destinationAccountId) {
    const dest = await findAccountInHousehold(
      context.householdId,
      input.destinationAccountId,
    );
    if (!dest) {
      throw new LiabilityDestinationAccountNotFoundError(
        `Repayment destination account ${input.destinationAccountId} not found in household`,
      );
    }
    if (dest.currency !== normalizedCurrency) {
      throw new LiabilityDestinationAccountCurrencyMismatchError(
        `Destination account currency (${dest.currency}) does not match liability currency (${normalizedCurrency})`,
      );
    }
  }

  // Parse observed outstanding
  const snapshotMinor = parseOptionalMoneyField(
    input.observedOutstandingNatural,
    input.observedOutstandingMinor,
    normalizedCurrency,
  );

  const snapshotMoney =
    snapshotMinor !== null ? money(snapshotMinor, normalizedCurrency) : null;
  const snapshotAt = input.observedOutstandingAt ?? null;

  if (snapshotMoney !== null && snapshotAt === null) {
    throw new Error(
      "Observation date must be provided when observed outstanding amount is set",
    );
  }
  if (snapshotMoney === null && snapshotAt !== null) {
    throw new Error(
      "Observed outstanding amount must be provided when observation date is set",
    );
  }

  const newId = crypto.randomUUID();
  const domainLiability = createLiability({
    id: toLiabilityId(newId),
    householdId: toHouseholdId(context.householdId),
    name: input.name,
    kind: input.kind ?? "loan",
    currency: normalizedCurrency,
    observedOutstanding: snapshotMoney,
    observedOutstandingAt: snapshotAt,
    responsiblePersonId: input.responsiblePersonId
      ? toPersonId(input.responsiblePersonId)
      : null,
    lender: input.lender ?? null,
    destinationAccountId: input.destinationAccountId
      ? toAccountId(input.destinationAccountId)
      : null,
    notes: input.notes ?? null,
  });

  await insertLiabilityInDb(context.householdId, domainLiability);
  const summary = await findLiabilityById(context.householdId, newId);
  if (!summary) {
    throw new Error("Failed to retrieve created liability");
  }
  return summary;
}

export async function updateHouseholdLiabilityEntry(
  context: HouseholdContext,
  liabilityId: string,
  input: UpdateLiabilityInput,
): Promise<HouseholdLiabilitySummary> {
  const existing = await findLiabilityById(context.householdId, liabilityId);
  if (!existing) {
    throw new LiabilityNotFoundError();
  }

  // Validate responsible person if provided
  if (input.responsiblePersonId) {
    const isMember = await isPersonInHousehold(
      context.householdId,
      input.responsiblePersonId,
    );
    if (!isMember) {
      throw new LiabilityInvalidResponsiblePersonError();
    }
  }

  // Validate destination account if provided
  if (input.destinationAccountId) {
    const dest = await findAccountInHousehold(
      context.householdId,
      input.destinationAccountId,
    );
    if (!dest) {
      throw new LiabilityDestinationAccountNotFoundError(
        `Repayment destination account ${input.destinationAccountId} not found in household`,
      );
    }
    if (dest.currency !== existing.currency) {
      throw new LiabilityDestinationAccountCurrencyMismatchError(
        `Destination account currency (${dest.currency}) does not match liability currency (${existing.currency})`,
      );
    }
  }

  let nextSnapshotMoney =
    existing.observedOutstandingMinor !== null
      ? money(existing.observedOutstandingMinor, existing.currency)
      : null;
  let nextSnapshotAt = existing.observedOutstandingAt;

  if (
    input.observedOutstandingNatural !== undefined ||
    input.observedOutstandingMinor !== undefined ||
    input.observedOutstandingAt !== undefined
  ) {
    const parsedMinor = parseOptionalMoneyField(
      input.observedOutstandingNatural,
      input.observedOutstandingMinor,
      existing.currency,
    );
    nextSnapshotMoney =
      parsedMinor !== null ? money(parsedMinor, existing.currency) : null;
    nextSnapshotAt = input.observedOutstandingAt ?? null;

    if (nextSnapshotMoney !== null && nextSnapshotAt === null) {
      throw new Error(
        "Observation date must be provided when observed outstanding amount is set",
      );
    }
    if (nextSnapshotMoney === null && nextSnapshotAt !== null) {
      throw new Error(
        "Observed outstanding amount must be provided when observation date is set",
      );
    }
  }

  const domainExisting = createLiability({
    id: toLiabilityId(existing.id),
    householdId: toHouseholdId(existing.householdId),
    name: existing.name,
    kind: existing.kind,
    currency: existing.currency,
    observedOutstanding:
      existing.observedOutstandingMinor !== null
        ? money(existing.observedOutstandingMinor, existing.currency)
        : null,
    observedOutstandingAt: existing.observedOutstandingAt,
    responsiblePersonId: existing.responsiblePersonId
      ? toPersonId(existing.responsiblePersonId)
      : null,
    lender: existing.lender,
    destinationAccountId: existing.destinationAccountId
      ? toAccountId(existing.destinationAccountId)
      : null,
    notes: existing.notes,
    version: existing.version,
    archivedAt: existing.archivedAt,
    createdAt: existing.createdAt,
    updatedAt: existing.updatedAt,
  });

  const domainUpdated = updateLiability(domainExisting, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.kind !== undefined ? { kind: input.kind } : {}),
    observedOutstanding: nextSnapshotMoney,
    observedOutstandingAt: nextSnapshotAt,
    responsiblePersonId:
      input.responsiblePersonId !== undefined
        ? input.responsiblePersonId
          ? toPersonId(input.responsiblePersonId)
          : null
        : domainExisting.responsiblePersonId,
    ...(input.lender !== undefined ? { lender: input.lender } : {}),
    destinationAccountId:
      input.destinationAccountId !== undefined
        ? input.destinationAccountId
          ? toAccountId(input.destinationAccountId)
          : null
        : domainExisting.destinationAccountId,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  });

  await updateLiabilityInDb({
    householdId: context.householdId,
    id: liabilityId,
    expectedVersion: input.expectedVersion,
    liability: domainUpdated,
  });

  const updatedSummary = await findLiabilityById(context.householdId, liabilityId);
  if (!updatedSummary) {
    throw new Error("Failed to retrieve updated liability");
  }
  return updatedSummary;
}

export async function archiveHouseholdLiabilityEntry(
  context: HouseholdContext,
  liabilityId: string,
  input: ArchiveLiabilityInput,
): Promise<HouseholdLiabilitySummary> {
  await archiveLiabilityInDb(
    context.householdId,
    liabilityId,
    input.expectedVersion,
  );
  const updated = await findLiabilityById(context.householdId, liabilityId);
  if (!updated) {
    throw new LiabilityNotFoundError();
  }
  return updated;
}

export async function unarchiveHouseholdLiabilityEntry(
  context: HouseholdContext,
  liabilityId: string,
  input: UnarchiveLiabilityInput,
): Promise<HouseholdLiabilitySummary> {
  await unarchiveLiabilityInDb(
    context.householdId,
    liabilityId,
    input.expectedVersion,
  );
  const updated = await findLiabilityById(context.householdId, liabilityId);
  if (!updated) {
    throw new LiabilityNotFoundError();
  }
  return updated;
}

export async function listHouseholdLiabilityRepayments(
  context: HouseholdContext,
  liabilityId: string,
  query?: ListLiabilityRepaymentsQuery,
): Promise<LiabilityRepayment[]> {
  const liability = await findLiabilityById(context.householdId, liabilityId);
  if (!liability) {
    throw new LiabilityNotFoundError();
  }

  return await listLiabilityRepaymentsByHousehold(
    context.householdId,
    liabilityId,
    { includeVoided: query?.includeVoided ?? true },
  );
}

export async function recordHouseholdLiabilityRepayment(
  context: HouseholdContext,
  liabilityId: string,
  input: CreateLiabilityRepaymentInput,
): Promise<{ repayment: LiabilityRepayment; transaction: Transaction | null }> {
  const liability = await findLiabilityById(context.householdId, liabilityId);
  if (!liability) {
    throw new LiabilityNotFoundError();
  }

  const currency = liability.currency;

  // Parse total amount
  let totalMinor: bigint | null = null;
  if (input.amountNatural !== undefined && input.amountNatural.trim() !== "") {
    const res = parseNaturalDecimalToMinor(input.amountNatural, currency);
    if (!res.success || !res.amountMinor) {
      throw new Error(`Invalid repayment amount: ${input.amountNatural}`);
    }
    totalMinor = BigInt(res.amountMinor);
  } else if (input.amountMinor !== undefined && input.amountMinor.trim() !== "") {
    totalMinor = BigInt(input.amountMinor);
  }

  if (totalMinor === null || totalMinor <= 0n) {
    throw new Error("Repayment amount is required and must be strictly positive");
  }

  // Parse breakdown components (unknown principal/interest/fee state preserved)
  const principalMinor = parseOptionalMoneyField(
    input.principalNatural,
    input.principalMinor,
    currency,
  );
  const interestMinor = parseOptionalMoneyField(
    input.interestNatural,
    input.interestMinor,
    currency,
  );
  const feeMinor = parseOptionalMoneyField(
    input.feeNatural,
    input.feeMinor,
    currency,
  );

  const totalMoney = money(totalMinor, currency);
  const principalMoney =
    principalMinor !== null ? money(principalMinor, currency) : null;
  const interestMoney =
    interestMinor !== null ? money(interestMinor, currency) : null;
  const feeMoney = feeMinor !== null ? money(feeMinor, currency) : null;

  // Validation: sum cannot exceed total
  const allocatedSum =
    (principalMinor ?? 0n) + (interestMinor ?? 0n) + (feeMinor ?? 0n);
  if (allocatedSum > totalMinor) {
    throw new LiabilityRepaymentInvalidAllocationError(
      "Sum of allocated components exceeds total repayment amount",
    );
  }
  if (
    principalMoney !== null &&
    interestMoney !== null &&
    feeMoney !== null &&
    allocatedSum !== totalMinor
  ) {
    throw new LiabilityRepaymentInvalidAllocationError(
      "When principal, interest, and fee are all supplied, they must sum exactly to total repayment amount",
    );
  }

  // If sourceAccountId is provided, construct a cash movement transaction linked to this repayment
  let cashTransaction: Transaction | undefined = undefined;
  if (input.sourceAccountId) {
    const sourceAccount = await findAccountInHousehold(
      context.householdId,
      input.sourceAccountId,
    );
    if (!sourceAccount) {
      throw new LiabilityRepaymentSourceAccountNotFoundError();
    }
    if (sourceAccount.currency !== currency) {
      throw new LiabilityRepaymentSourceAccountCurrencyMismatchError();
    }

    const txId = toTransactionId(crypto.randomUUID());
    const hId = toHouseholdId(context.householdId);

    if (liability.destinationAccountId) {
      // Verified transfer between source account and liability destination account
      cashTransaction = createTransfer({
        id: txId,
        householdId: hId,
        fromAccountId: toAccountId(input.sourceAccountId),
        toAccountId: toAccountId(liability.destinationAccountId),
        amount: totalMoney,
        occurredOn: input.paidAt,
      });
    } else {
      // Direct cash payment / expense to lender or liability
      const payerPersonId = liability.responsiblePersonId
        ? toPersonId(liability.responsiblePersonId)
        : context.personId
          ? toPersonId(context.personId)
          : undefined;

      if (!payerPersonId) {
        throw new Error("Unable to determine payer person ID for repayment cash transaction");
      }

      cashTransaction = createExpense({
        id: txId,
        householdId: hId,
        accountId: toAccountId(input.sourceAccountId),
        amount: totalMoney,
        payee: liability.lender?.trim() || liability.name,
        paidByPersonId: payerPersonId,
        occurredOn: input.paidAt,
        categoryId: null,
      });
    }
  }

  const repaymentId = toLiabilityRepaymentId(input.submissionId ?? crypto.randomUUID());
  const domainRepayment = createLiabilityRepayment({
    id: repaymentId,
    householdId: toHouseholdId(context.householdId),
    liabilityId: toLiabilityId(liability.id),
    transactionId: input.transactionId
      ? toTransactionId(input.transactionId)
      : null,
    paidAt: input.paidAt,
    amount: totalMoney,
    principalAmount: principalMoney,
    interestAmount: interestMoney,
    feeAmount: feeMoney,
    notes: input.notes ?? null,
  });

  const auditActor = {
    authUserId: context.authUserId ?? null,
    personId: context.personId ?? null,
    source: "manual" as const,
  };

  return await recordLiabilityRepaymentInDb({
    householdId: context.householdId,
    repayment: domainRepayment,
    ...(cashTransaction !== undefined ? { cashTransaction } : {}),
    auditActor,
  });
}

export async function voidHouseholdLiabilityRepayment(
  context: HouseholdContext,
  liabilityId: string,
  repaymentId: string,
  input: VoidLiabilityRepaymentInput,
): Promise<LiabilityRepayment> {
  const existingRep = await findLiabilityRepaymentById(
    context.householdId,
    repaymentId,
  );
  if (!existingRep) {
    throw new LiabilityRepaymentNotFoundError();
  }
  if (existingRep.liabilityId !== liabilityId) {
    throw new LiabilityRepaymentNotFoundError();
  }

  const auditActor = {
    authUserId: context.authUserId ?? null,
    personId: context.personId ?? null,
    source: "manual" as const,
  };

  return await voidLiabilityRepaymentInDb({
    householdId: context.householdId,
    id: repaymentId,
    expectedVersion: input.expectedVersion,
    ...(input.voidReason !== undefined ? { voidReason: input.voidReason } : {}),
    auditActor,
  });
}
