import "server-only";

import { listHouseholdAnalyticsTransactions } from "@nodvis/finance-db";

export type AnalyticsFilters = { from?: Date; to?: Date };

type CurrencySummary = {
  currency: string;
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  uncategorizedMinor: bigint;
  months: Map<string, { incomeMinor: bigint; expenseMinor: bigint }>;
  categories: Map<string, bigint>;
  counterparties: Map<string, bigint>;
  largest: Array<{ id: string; amountMinor: bigint; occurredOn: Date; label: string }>;
};

export async function getHouseholdAnalytics(householdId: string, filters: AnalyticsFilters = {}) {
  const rows = await listHouseholdAnalyticsTransactions(householdId, filters.from, filters.to);
  const summaries = new Map<string, CurrencySummary>();
  for (const row of rows) {
    let summary = summaries.get(row.currency);
    if (!summary) {
      summary = { currency: row.currency, incomeMinor: 0n, expenseMinor: 0n, netMinor: 0n, uncategorizedMinor: 0n, months: new Map(), categories: new Map(), counterparties: new Map(), largest: [] };
      summaries.set(row.currency, summary);
    }
    const amount = row.amountMinor;
    const month = row.occurredOn.toISOString().slice(0, 7);
    const monthSummary = summary.months.get(month) ?? { incomeMinor: 0n, expenseMinor: 0n };
    const label = (row.payee ?? row.source ?? "Unknown").trim() || "Unknown";
    if (row.kind === "income") {
      summary.incomeMinor += amount;
      summary.netMinor += amount;
      monthSummary.incomeMinor += amount;
    } else {
      summary.expenseMinor += amount;
      summary.netMinor -= amount;
      monthSummary.expenseMinor += amount;
      summary.counterparties.set(label, (summary.counterparties.get(label) ?? 0n) + amount);
      if (row.categoryName) summary.categories.set(row.categoryName, (summary.categories.get(row.categoryName) ?? 0n) + amount);
      else summary.uncategorizedMinor += amount;
      summary.largest.push({ id: row.id, amountMinor: amount, occurredOn: row.occurredOn, label });
    }
    summary.months.set(month, monthSummary);
  }
  return [...summaries.values()].map((summary) => ({
    currency: summary.currency,
    incomeMinor: summary.incomeMinor.toString(),
    expenseMinor: summary.expenseMinor.toString(),
    netMinor: summary.netMinor.toString(),
    uncategorizedMinor: summary.uncategorizedMinor.toString(),
    months: [...summary.months.entries()].map(([month, values]) => ({ month, incomeMinor: values.incomeMinor.toString(), expenseMinor: values.expenseMinor.toString(), netMinor: (values.incomeMinor - values.expenseMinor).toString() })),
    categories: [...summary.categories.entries()].map(([name, amountMinor]) => ({ name, amountMinor: amountMinor.toString() })).sort((a, b) => a.name.localeCompare(b.name)),
    counterparties: [...summary.counterparties.entries()].map(([name, amountMinor]) => ({ name, amountMinor: amountMinor.toString() })).sort((a, b) => (BigInt(b.amountMinor) > BigInt(a.amountMinor) ? 1 : -1)).slice(0, 10),
    largest: summary.largest.sort((a, b) => (b.amountMinor > a.amountMinor ? 1 : -1)).slice(0, 10).map((item) => ({ ...item, amountMinor: item.amountMinor.toString(), occurredOn: item.occurredOn.toISOString() })),
  }));
}
