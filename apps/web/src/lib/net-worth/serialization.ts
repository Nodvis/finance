import type {
  BalanceObservationRecord,
  BalanceObservationSource,
} from "@nodvis/finance-db";
import type {
  HistoricalNetWorthPoint,
  HistoricalSeriesByCurrency,
  NetWorthConfidence,
  NetWorthHistorySummary,
} from "@nodvis/finance-domain";

export type SerializedNetWorthPoint = {
  date: string;
  timestamp: string;
  currency: string;
  assetsMinor: string;
  liabilitiesMinor: string;
  netWorthMinor: string;
  confidence: NetWorthConfidence;
  isComplete: boolean;
  observedSubjectCount: number;
  totalSubjectCount: number;
  missingSubjectNames: string[];
};

export type SerializedHistoricalSeriesByCurrency = {
  currency: string;
  points: SerializedNetWorthPoint[];
  currentNetWorthMinor: string;
  currentAssetsMinor: string;
  currentLiabilitiesMinor: string;
  currentConfidence: NetWorthConfidence;
  currentIsComplete: boolean;
  missingSubjectNames: string[];
  latestObservedAt: string | null;
};

export type SerializedNetWorthSummary = {
  byCurrency: SerializedHistoricalSeriesByCurrency[];
};

export type SerializedBalanceObservation = {
  id: string;
  householdId: string;
  accountId: string | null;
  liabilityId: string | null;
  subjectName: string | null;
  subjectKind: "account" | "liability" | null;
  accountType: string | null;
  amountMinor: string;
  currency: string;
  observedAt: string;
  source: BalanceObservationSource;
  note: string | null;
  createdAt: string;
};

export function serializeNetWorthPoint(point: HistoricalNetWorthPoint): SerializedNetWorthPoint {
  return {
    date: point.date,
    timestamp: point.timestamp.toISOString(),
    currency: point.currency,
    assetsMinor: point.assetsMinor.toString(),
    liabilitiesMinor: point.liabilitiesMinor.toString(),
    netWorthMinor: point.netWorthMinor.toString(),
    confidence: point.confidence,
    isComplete: point.isComplete,
    observedSubjectCount: point.observedSubjectCount,
    totalSubjectCount: point.totalSubjectCount,
    missingSubjectNames: [...point.missingSubjectNames],
  };
}

export function serializeHistoricalSeries(
  series: HistoricalSeriesByCurrency,
): SerializedHistoricalSeriesByCurrency {
  return {
    currency: series.currency,
    points: series.points.map(serializeNetWorthPoint),
    currentNetWorthMinor: series.currentNetWorthMinor.toString(),
    currentAssetsMinor: series.currentAssetsMinor.toString(),
    currentLiabilitiesMinor: series.currentLiabilitiesMinor.toString(),
    currentConfidence: series.currentConfidence,
    currentIsComplete: series.currentIsComplete,
    missingSubjectNames: [...series.missingSubjectNames],
    latestObservedAt: series.latestObservedAt ? series.latestObservedAt.toISOString() : null,
  };
}

export function serializeNetWorthSummary(
  summary: NetWorthHistorySummary,
): SerializedNetWorthSummary {
  return {
    byCurrency: summary.byCurrency.map(serializeHistoricalSeries),
  };
}

export function serializeBalanceObservation(
  record: BalanceObservationRecord,
): SerializedBalanceObservation {
  return {
    id: record.id,
    householdId: record.householdId,
    accountId: record.accountId,
    liabilityId: record.liabilityId,
    subjectName: record.subjectName ?? null,
    subjectKind: record.subjectKind ?? null,
    accountType: record.accountType ?? null,
    amountMinor: record.amountMinor.toString(),
    currency: record.currency,
    observedAt: record.observedAt.toISOString(),
    source: record.source,
    note: record.note ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}
