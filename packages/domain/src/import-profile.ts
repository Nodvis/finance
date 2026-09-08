import type { StatementImportMappingConfig } from "./import";

export type StatementImportProfile = Readonly<{
  id: string;
  householdId: string;
  accountId: string | null;
  name: string;
  mappingConfig: StatementImportMappingConfig;
  autoProcessSafe: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CreateStatementImportProfileInput = Readonly<{
  id?: string;
  householdId: string;
  accountId?: string | null;
  name: string;
  mappingConfig: StatementImportMappingConfig;
  autoProcessSafe?: boolean;
  isDefault?: boolean;
}>;

/**
 * Validates statement import profile input before persistence.
 */
export function validateStatementImportProfileInput(input: {
  name: string;
  mappingConfig: StatementImportMappingConfig;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const trimmedName = input.name ? input.name.trim() : "";
  if (!trimmedName) {
    errors.push("Profile name is required");
  } else if (trimmedName.length > 160) {
    errors.push("Profile name cannot exceed 160 characters");
  }

  const { mappingConfig } = input;
  if (!mappingConfig) {
    errors.push("Mapping configuration is required");
    return { valid: false, errors };
  }

  if (!mappingConfig.dateColumn || mappingConfig.dateColumn.trim() === "") {
    errors.push("Date column is required in mapping config");
  }
  if (!mappingConfig.descriptionColumn || mappingConfig.descriptionColumn.trim() === "") {
    errors.push("Description column is required in mapping config");
  }
  if (mappingConfig.amountMode === "signed") {
    if (!mappingConfig.amountColumn || mappingConfig.amountColumn.trim() === "") {
      errors.push("Amount column is required for signed amount mode");
    }
  } else if (mappingConfig.amountMode === "separate") {
    if (
      (!mappingConfig.debitColumn || mappingConfig.debitColumn.trim() === "") &&
      (!mappingConfig.creditColumn || mappingConfig.creditColumn.trim() === "")
    ) {
      errors.push(
        "At least one of debitColumn or creditColumn is required for separate amount mode",
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Server-side conservative rule for determining if an import row is strictly safe for auto-commit.
 *
 * MUST NEVER auto-commit:
 * - invalid rows (!valid or missing fields)
 * - ambiguous rows (ambiguityState !== 'unambiguous')
 * - duplicates (status === 'duplicate' or existing dedupeHash/authoritativeId match)
 * - rows with possible manual match candidates (possibleMatch != null)
 * - rows matching voided transactions (errorCode === 'MATCHES_VOIDED_TRANSACTION')
 * - non-positive or unsupported currency/kind values
 */
export function isSafeToAutoCommitRow(row: {
  valid: boolean;
  status: string;
  ambiguityState?: string | null | undefined;
  possibleMatch?: unknown;
  errorCode?: string | null | undefined;
  normalizedOccurredOn?: Date | string | null | undefined;
  normalizedAmountMinor?: bigint | string | null | undefined;
  normalizedCurrency?: string | null | undefined;
  normalizedKind?: string | null | undefined;
}): boolean {
  if (!row.valid) return false;
  if (row.status !== "pending") return false;
  if (row.ambiguityState && row.ambiguityState !== "unambiguous") return false;
  if (row.possibleMatch != null) return false;
  if (row.errorCode != null && row.errorCode !== "") return false;
  if (row.normalizedOccurredOn == null) return false;
  if (row.normalizedAmountMinor == null) return false;
  if (
    typeof row.normalizedAmountMinor === "bigint" &&
    row.normalizedAmountMinor <= 0n
  ) {
    return false;
  }
  if (
    typeof row.normalizedAmountMinor === "string" &&
    row.normalizedAmountMinor.startsWith("-")
  ) {
    return false;
  }
  if (!row.normalizedCurrency || row.normalizedCurrency.trim() === "") {
    return false;
  }
  if (row.normalizedKind !== "expense" && row.normalizedKind !== "income") {
    return false;
  }
  return true;
}
