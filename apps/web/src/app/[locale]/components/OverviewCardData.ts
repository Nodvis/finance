import type { SerializedNetWorthSummary } from "@/lib/net-worth/serialization";

export type SerializedDebtAmount = {
  currency: string;
  amountMinor: string;
};

/** Return observed liabilities only; assets and net worth are not debt. */
export function getDebtAmounts(
  summary: SerializedNetWorthSummary | null | undefined,
): SerializedDebtAmount[] {
  return (summary?.byCurrency ?? [])
    .filter((series) => series.currentConfidence !== "no_data")
    .map((series) => ({
      currency: series.currency,
      amountMinor: series.currentLiabilitiesMinor,
    }));
}
