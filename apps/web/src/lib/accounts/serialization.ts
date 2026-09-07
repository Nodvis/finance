import type { HouseholdAccountSummary } from "@nodvis/finance-db";

export type SerializedHouseholdAccount = Omit<
  HouseholdAccountSummary,
  "balanceSnapshotMinor" | "balanceSnapshotAt" | "archivedAt"
> & {
  balanceSnapshotMinor: string | null;
  balanceSnapshotAt: string | null;
  archivedAt: string | null;
};

export function serializeAccount(
  account: HouseholdAccountSummary,
): SerializedHouseholdAccount {
  return {
    ...account,
    balanceSnapshotMinor:
      account.balanceSnapshotMinor !== null
        ? account.balanceSnapshotMinor.toString()
        : null,
    balanceSnapshotAt:
      account.balanceSnapshotAt !== null
        ? account.balanceSnapshotAt.toISOString()
        : null,
    archivedAt:
      account.archivedAt !== null ? account.archivedAt.toISOString() : null,
  };
}
