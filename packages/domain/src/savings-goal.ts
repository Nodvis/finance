import type {
  AccountId,
  HouseholdId,
  SavingsGoalId,
} from "./identity";
import { savingsGoalId } from "./identity";
import type { CurrencyCode, Money } from "./money";
import { addMoney, currencyCode, money } from "./money";

export const MAX_SAVINGS_GOAL_NAME_LENGTH = 160;
export const MAX_SAVINGS_GOAL_NOTES_LENGTH = 500;

const CALENDAR_DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

export const SAVINGS_GOAL_STATUSES = [
  "active",
  "completed",
  "archived",
] as const;

export type SavingsGoalStatus = (typeof SAVINGS_GOAL_STATUSES)[number];

export function isSavingsGoalStatus(value: unknown): value is SavingsGoalStatus {
  return typeof value === "string" && (SAVINGS_GOAL_STATUSES as readonly string[]).includes(value);
}

export function validateCalendarDate(dateStr: string): string {
  if (!CALENDAR_DATE_REGEX.test(dateStr)) {
    throw new Error(`Invalid calendar date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number.parseInt(yearStr!, 10);
  const month = Number.parseInt(monthStr!, 10);
  const day = Number.parseInt(dayStr!, 10);

  const dateObj = new Date(Date.UTC(year, month - 1, day));
  if (
    dateObj.getUTCFullYear() !== year ||
    dateObj.getUTCMonth() !== month - 1 ||
    dateObj.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${dateStr}`);
  }
  return dateStr;
}

export function validateSavingsGoalName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Savings goal name cannot be blank");
  }
  if (trimmed.length > MAX_SAVINGS_GOAL_NAME_LENGTH) {
    throw new Error(
      `Savings goal name exceeds maximum length of ${MAX_SAVINGS_GOAL_NAME_LENGTH} characters`,
    );
  }
  return trimmed;
}

export function validateSavingsGoalNotes(raw?: string | null): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_SAVINGS_GOAL_NOTES_LENGTH) {
    throw new Error(
      `Savings goal notes exceeds maximum length of ${MAX_SAVINGS_GOAL_NOTES_LENGTH} characters`,
    );
  }
  return trimmed;
}

export function validateTargetAmount(amount: Money): Money {
  if (amount.amountMinor <= 0n) {
    throw new Error("Savings goal target amount must be strictly positive");
  }
  return amount;
}

export function validateCurrentAmount(amount: Money, expectedCurrency: CurrencyCode): Money {
  if (amount.amountMinor < 0n) {
    throw new Error("Savings goal current amount cannot be negative");
  }
  if (amount.currency !== expectedCurrency) {
    throw new Error(
      `Current amount currency (${amount.currency}) must match target amount currency (${expectedCurrency})`,
    );
  }
  return amount;
}

export type SavingsGoal = Readonly<{
  id: SavingsGoalId;
  householdId: HouseholdId;
  name: string;
  targetAmount: Money;
  currentAmount: Money;
  targetDate: string | null;
  accountId: AccountId | null;
  status: SavingsGoalStatus;
  notes: string | null;
  completedAt: Date | null;
  archivedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CreateSavingsGoalInput = Readonly<{
  id?: SavingsGoalId | undefined;
  householdId: HouseholdId;
  name: string;
  targetAmount: Money;
  currentAmount?: Money | undefined;
  targetDate?: string | null | undefined;
  accountId?: AccountId | null | undefined;
  notes?: string | null | undefined;
  status?: SavingsGoalStatus | undefined;
  completedAt?: Date | null | undefined;
  archivedAt?: Date | null | undefined;
  version?: number | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}>;

export type UpdateSavingsGoalInput = Readonly<{
  name?: string | undefined;
  targetAmount?: Money | undefined;
  currentAmount?: Money | undefined;
  targetDate?: string | null | undefined;
  accountId?: AccountId | null | undefined;
  notes?: string | null | undefined;
}>;

export function createSavingsGoal(input: CreateSavingsGoalInput): SavingsGoal {
  const id = input.id ?? savingsGoalId(crypto.randomUUID());
  const name = validateSavingsGoalName(input.name);
  const targetAmount = validateTargetAmount(input.targetAmount);
  const currentAmount = input.currentAmount
    ? validateCurrentAmount(input.currentAmount, targetAmount.currency)
    : money(0n, targetAmount.currency);
  const targetDate = input.targetDate ? validateCalendarDate(input.targetDate) : null;
  const notes = validateSavingsGoalNotes(input.notes);
  const now = new Date();

  const isAlreadyMet = currentAmount.amountMinor >= targetAmount.amountMinor;
  const initialStatus: SavingsGoalStatus = input.status ?? (isAlreadyMet ? "completed" : "active");
  const completedAt = input.completedAt ?? (initialStatus === "completed" ? now : null);

  return Object.freeze({
    id,
    householdId: input.householdId,
    name,
    targetAmount,
    currentAmount,
    targetDate,
    accountId: input.accountId ?? null,
    status: initialStatus,
    notes,
    completedAt,
    archivedAt: input.archivedAt ?? null,
    version: input.version ?? 1,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  });
}

export function updateSavingsGoal(
  existing: SavingsGoal,
  input: UpdateSavingsGoalInput,
): SavingsGoal {
  if (existing.status === "archived") {
    throw new Error("Cannot update an archived savings goal; restore it first");
  }

  const name = input.name !== undefined ? validateSavingsGoalName(input.name) : existing.name;
  const targetAmount = input.targetAmount !== undefined ? validateTargetAmount(input.targetAmount) : existing.targetAmount;
  const currentAmount = input.currentAmount !== undefined
    ? validateCurrentAmount(input.currentAmount, targetAmount.currency)
    : validateCurrentAmount(existing.currentAmount, targetAmount.currency);

  const targetDate = input.targetDate !== undefined
    ? (input.targetDate === null ? null : validateCalendarDate(input.targetDate))
    : existing.targetDate;

  const notes = input.notes !== undefined ? validateSavingsGoalNotes(input.notes) : existing.notes;
  const accountId = input.accountId !== undefined ? input.accountId : existing.accountId;

  // If status is active but target is met, auto-complete
  let status = existing.status;
  let completedAt = existing.completedAt;
  if (status === "active" && currentAmount.amountMinor >= targetAmount.amountMinor) {
    status = "completed";
    completedAt = new Date();
  } else if (status === "completed" && currentAmount.amountMinor < targetAmount.amountMinor) {
    // If target increased or current decreased below target, transition back to active
    status = "active";
    completedAt = null;
  }

  return Object.freeze({
    ...existing,
    name,
    targetAmount,
    currentAmount,
    targetDate,
    accountId,
    status,
    notes,
    completedAt,
    version: existing.version + 1,
    updatedAt: new Date(),
  });
}

export function completeSavingsGoal(
  existing: SavingsGoal,
  completedAt: Date = new Date(),
): SavingsGoal {
  if (existing.status === "completed") {
    return existing;
  }

  return Object.freeze({
    ...existing,
    status: "completed",
    completedAt,
    archivedAt: null,
    version: existing.version + 1,
    updatedAt: new Date(),
  });
}

export function uncompleteSavingsGoal(existing: SavingsGoal): SavingsGoal {
  if (existing.status !== "completed") {
    return existing;
  }

  return Object.freeze({
    ...existing,
    status: "active",
    completedAt: null,
    version: existing.version + 1,
    updatedAt: new Date(),
  });
}

export function archiveSavingsGoal(
  existing: SavingsGoal,
  archivedAt: Date = new Date(),
): SavingsGoal {
  if (existing.status === "archived") {
    return existing;
  }

  return Object.freeze({
    ...existing,
    status: "archived",
    archivedAt,
    version: existing.version + 1,
    updatedAt: new Date(),
  });
}

export function unarchiveSavingsGoal(existing: SavingsGoal): SavingsGoal {
  if (existing.status !== "archived") {
    return existing;
  }

  const restoredStatus: SavingsGoalStatus = existing.completedAt ? "completed" : "active";

  return Object.freeze({
    ...existing,
    status: restoredStatus,
    archivedAt: null,
    version: existing.version + 1,
    updatedAt: new Date(),
  });
}

export function contributeToSavingsGoal(
  existing: SavingsGoal,
  contribution: Money,
): SavingsGoal {
  if (existing.status === "archived") {
    throw new Error("Cannot contribute to an archived savings goal");
  }
  if (contribution.amountMinor <= 0n) {
    throw new Error("Contribution amount must be strictly positive");
  }
  if (contribution.currency !== existing.targetAmount.currency) {
    throw new Error(
      `Contribution currency (${contribution.currency}) does not match goal currency (${existing.targetAmount.currency})`,
    );
  }

  const newCurrent = addMoney(existing.currentAmount, contribution);
  const isNowCompleted = newCurrent.amountMinor >= existing.targetAmount.amountMinor;

  return Object.freeze({
    ...existing,
    currentAmount: newCurrent,
    status: isNowCompleted ? "completed" : existing.status,
    completedAt: isNowCompleted && !existing.completedAt ? new Date() : existing.completedAt,
    version: existing.version + 1,
    updatedAt: new Date(),
  });
}

export type SavingsGoalCalculationExplanation = Readonly<{
  formula: "no_target_date" | "already_completed" | "target_date_passed" | "periodic_ceiling";
  monthsRemaining: number | null;
  weeksRemaining: number | null;
  remainingAmountMinor: bigint;
  monthlyContributionMinor: bigint | null;
  weeklyContributionMinor: bigint | null;
  monthlyRoundUpMinor: bigint;
  weeklyRoundUpMinor: bigint;
}>;

export type SavingsGoalContributionCalculation = Readonly<{
  targetAmountMinor: bigint;
  currentAmountMinor: bigint;
  remainingAmountMinor: bigint;
  currency: CurrencyCode;
  isCompleted: boolean;
  isOverdue: boolean;
  progressBasisPoints: number; // 0 to 10000 (100.00%)
  progressPercentage: number;  // 0 to 100
  targetDate: string | null;
  asOfDate: string;
  daysRemaining: number | null;
  monthsRemaining: number | null;
  weeksRemaining: number | null;
  suggestedMonthlyContributionMinor: bigint | null;
  suggestedWeeklyContributionMinor: bigint | null;
  explanation: SavingsGoalCalculationExplanation;
}>;

function ceilDivideBigInt(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n || numerator <= 0n) {
    return 0n;
  }
  return (numerator + denominator - 1n) / denominator;
}

/**
 * Deterministically calculates remaining amount, progress, and periodic contributions (monthly/weekly)
 * required to achieve the goal by the target date, using exact BigInt ceiling arithmetic to avoid shortfalls.
 */
export function calculateSavingsGoalContribution(
  goal: Pick<SavingsGoal, "targetAmount" | "currentAmount" | "targetDate">,
  asOfDateStr: string = new Date().toISOString().slice(0, 10),
): SavingsGoalContributionCalculation {
  validateCalendarDate(asOfDateStr);

  const targetMinor = goal.targetAmount.amountMinor;
  const currentMinor = goal.currentAmount.amountMinor;
  const currency = goal.targetAmount.currency;

  const isCompleted = currentMinor >= targetMinor;
  const remainingMinor = isCompleted ? 0n : targetMinor - currentMinor;

  const progressBasisPoints = targetMinor > 0n
    ? Number((currentMinor * 10000n) / targetMinor)
    : 10000;
  const boundedBasisPoints = Math.min(10000, Math.max(0, progressBasisPoints));
  const progressPercentage = Math.round(boundedBasisPoints) / 100;

  if (!goal.targetDate) {
    return Object.freeze({
      targetAmountMinor: targetMinor,
      currentAmountMinor: currentMinor,
      remainingAmountMinor: remainingMinor,
      currency,
      isCompleted,
      isOverdue: false,
      progressBasisPoints: boundedBasisPoints,
      progressPercentage,
      targetDate: null,
      asOfDate: asOfDateStr,
      daysRemaining: null,
      monthsRemaining: null,
      weeksRemaining: null,
      suggestedMonthlyContributionMinor: null,
      suggestedWeeklyContributionMinor: null,
      explanation: Object.freeze({
        formula: isCompleted ? "already_completed" : "no_target_date",
        monthsRemaining: null,
        weeksRemaining: null,
        remainingAmountMinor: remainingMinor,
        monthlyContributionMinor: null,
        weeklyContributionMinor: null,
        monthlyRoundUpMinor: 0n,
        weeklyRoundUpMinor: 0n,
      }),
    });
  }

  const targetDateStr = validateCalendarDate(goal.targetDate);

  if (isCompleted) {
    return Object.freeze({
      targetAmountMinor: targetMinor,
      currentAmountMinor: currentMinor,
      remainingAmountMinor: 0n,
      currency,
      isCompleted: true,
      isOverdue: false,
      progressBasisPoints: 10000,
      progressPercentage: 100,
      targetDate: targetDateStr,
      asOfDate: asOfDateStr,
      daysRemaining: 0,
      monthsRemaining: 0,
      weeksRemaining: 0,
      suggestedMonthlyContributionMinor: 0n,
      suggestedWeeklyContributionMinor: 0n,
      explanation: Object.freeze({
        formula: "already_completed",
        monthsRemaining: 0,
        weeksRemaining: 0,
        remainingAmountMinor: 0n,
        monthlyContributionMinor: 0n,
        weeklyContributionMinor: 0n,
        monthlyRoundUpMinor: 0n,
        weeklyRoundUpMinor: 0n,
      }),
    });
  }

  const [asOfYear, asOfMonth, asOfDay] = asOfDateStr.split("-").map(Number);
  const [targetYear, targetMonth, targetDay] = targetDateStr.split("-").map(Number);

  const asOfDateObj = new Date(Date.UTC(asOfYear!, asOfMonth! - 1, asOfDay!));
  const targetDateObj = new Date(Date.UTC(targetYear!, targetMonth! - 1, targetDay!));

  const diffMs = targetDateObj.getTime() - asOfDateObj.getTime();
  const daysDiff = Math.round(diffMs / 86_400_000);

  if (daysDiff < 0) {
    // Target date has passed without reaching the goal
    return Object.freeze({
      targetAmountMinor: targetMinor,
      currentAmountMinor: currentMinor,
      remainingAmountMinor: remainingMinor,
      currency,
      isCompleted: false,
      isOverdue: true,
      progressBasisPoints: boundedBasisPoints,
      progressPercentage,
      targetDate: targetDateStr,
      asOfDate: asOfDateStr,
      daysRemaining: 0,
      monthsRemaining: 0,
      weeksRemaining: 0,
      suggestedMonthlyContributionMinor: remainingMinor,
      suggestedWeeklyContributionMinor: remainingMinor,
      explanation: Object.freeze({
        formula: "target_date_passed",
        monthsRemaining: 0,
        weeksRemaining: 0,
        remainingAmountMinor: remainingMinor,
        monthlyContributionMinor: remainingMinor,
        weeklyContributionMinor: remainingMinor,
        monthlyRoundUpMinor: 0n,
        weeklyRoundUpMinor: 0n,
      }),
    });
  }

  // Target date is today or in the future
  const calendarMonths = (targetYear! - asOfYear!) * 12 + (targetMonth! - asOfMonth!);
  const monthsRemaining = Math.max(1, calendarMonths);
  const weeksRemaining = Math.max(1, Math.ceil(daysDiff / 7));

  const monthlyContribution = ceilDivideBigInt(remainingMinor, BigInt(monthsRemaining));
  const weeklyContribution = ceilDivideBigInt(remainingMinor, BigInt(weeksRemaining));

  const monthlyRoundUp = monthlyContribution * BigInt(monthsRemaining) - remainingMinor;
  const weeklyRoundUp = weeklyContribution * BigInt(weeksRemaining) - remainingMinor;

  return Object.freeze({
    targetAmountMinor: targetMinor,
    currentAmountMinor: currentMinor,
    remainingAmountMinor: remainingMinor,
    currency,
    isCompleted: false,
    isOverdue: false,
    progressBasisPoints: boundedBasisPoints,
    progressPercentage,
    targetDate: targetDateStr,
    asOfDate: asOfDateStr,
    daysRemaining: daysDiff,
    monthsRemaining,
    weeksRemaining,
    suggestedMonthlyContributionMinor: monthlyContribution,
    suggestedWeeklyContributionMinor: weeklyContribution,
    explanation: Object.freeze({
      formula: "periodic_ceiling",
      monthsRemaining,
      weeksRemaining,
      remainingAmountMinor: remainingMinor,
      monthlyContributionMinor: monthlyContribution,
      weeklyContributionMinor: weeklyContribution,
      monthlyRoundUpMinor: monthlyRoundUp,
      weeklyRoundUpMinor: weeklyRoundUp,
    }),
  });
}
