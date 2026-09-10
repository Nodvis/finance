import {
  serializeObligation,
  type ObligationWithTransaction,
  type UpcomingObligationsSummary,
} from "@nodvis/finance-db";
import type {
  SerializedHouseholdObligation,
  SerializedUpcomingObligationsSummary,
} from "./schema";

export function serializeHouseholdObligation(
  item: ObligationWithTransaction,
): SerializedHouseholdObligation {
  return serializeObligation(item);
}

export function serializeUpcomingObligationsSummary(
  summary: UpcomingObligationsSummary,
): SerializedUpcomingObligationsSummary {
  return {
    upcomingCount: summary.upcomingCount,
    overdueCount: summary.overdueCount,
    paidCount: summary.paidCount,
    upcomingByCurrency: summary.upcomingByCurrency.map((item) => ({
      currency: item.currency,
      totalMinor: item.totalMinor.toString(),
    })),
    overdueByCurrency: summary.overdueByCurrency.map((item) => ({
      currency: item.currency,
      totalMinor: item.totalMinor.toString(),
    })),
  };
}
