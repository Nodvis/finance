"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SerializedHistoricalSeriesByCurrency } from "@/lib/net-worth/serialization";
import { getCurrencyFractionDigits } from "@/lib/transactions/money-entry";

type Props = {
  series: SerializedHistoricalSeriesByCurrency;
  locale: string;
  labels: {
    netWorth: string;
    assets: string;
    liabilities: string;
    complete: string;
    incomplete: string;
    missing: string;
    empty: string;
  };
};

function boundedMinor(value: string) {
  try {
    const parsed = BigInt(value);
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    return Number(parsed > max ? max : parsed < -max ? -max : parsed);
  } catch {
    return 0;
  }
}

function formatMinor(
  value: string,
  currency: string,
  locale: string,
  fallback: string,
) {
  try {
    const minor = BigInt(value);
    const sign = minor < 0n ? "−" : "";
    const absolute = minor < 0n ? -minor : minor;
    const fractionDigits = getCurrencyFractionDigits(currency);
    const base = 10n ** BigInt(fractionDigits);
    const whole = absolute / base;
    const fraction = (absolute % base).toString().padStart(fractionDigits, "0");
    const formattedWhole = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(whole);
    const decimal = fractionDigits
      ? new Intl.NumberFormat(locale)
          .formatToParts(1.1)
          .find((part) => part.type === "decimal")?.value ?? "."
      : "";
    return `${sign}${formattedWhole}${decimal}${fractionDigits ? fraction : ""} ${currency}`;
  } catch {
    return fallback;
  }
}

function formatAxisValue(value: number, currency: string, locale: string) {
  const fractionDigits = getCurrencyFractionDigits(currency);
  const major = value / 10 ** fractionDigits;
  return `${new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(major)} ${currency}`;
}

function formatDateLabel(dateStr: string, locale: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function NetWorthChart({ series, locale, labels }: Props) {
  const chartData = series.points.map((p) => ({
    date: p.date,
    formattedDate: formatDateLabel(p.date, locale),
    netWorth: boundedMinor(p.netWorthMinor),
    assets: boundedMinor(p.assetsMinor),
    liabilities: boundedMinor(p.liabilitiesMinor),
    rawNetWorth: p.netWorthMinor,
    rawAssets: p.assetsMinor,
    rawLiabilities: p.liabilitiesMinor,
    confidence: p.confidence,
    isComplete: p.isComplete,
    missing: p.missingSubjectNames,
  }));

  const hasData =
    chartData.length > 0 &&
    series.currentConfidence !== "no_data";

  const accessibleLabel = hasData
    ? `${labels.netWorth} ${series.currency}: ${chartData.map((p) => `${p.date}, ${formatMinor(p.rawNetWorth, series.currency, locale, labels.empty)} (${p.isComplete ? labels.complete : labels.incomplete})`).join("; ")}`
    : labels.empty;

  return (
    <div className="w-full">
      {hasData ? (
        <div
          className="h-64 w-full sm:h-72"
          role="img"
          aria-label={accessibleLabel}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id={`netWorthGradient-${series.currency}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#C7F36A" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#C7F36A" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="formattedDate"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickFormatter={(value) =>
                  formatAxisValue(value, series.currency, locale)
                }
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0]?.payload as (typeof chartData)[0];
                  if (!data) return null;
                  return (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg text-xs">
                      <p className="font-semibold text-[var(--foreground)] mb-1.5">
                        {data.formattedDate}
                      </p>
                      <div className="space-y-1 font-mono">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[var(--muted-foreground)] flex items-center gap-1.5">
                            <i className="h-2 w-2 rounded-full bg-[var(--finance-signal-dark)] dark:bg-[var(--finance-signal)]" />
                            {labels.netWorth}:
                          </span>
                          <span className="font-bold text-[var(--foreground)]">
                            {formatMinor(
                              data.rawNetWorth,
                              series.currency,
                              locale,
                              labels.empty,
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[var(--muted-foreground)] flex items-center gap-1.5">
                            <i className="h-2 w-2 rounded-full bg-emerald-500" />
                            {labels.assets}:
                          </span>
                          <span className="text-[var(--foreground)]">
                            {formatMinor(
                              data.rawAssets,
                              series.currency,
                              locale,
                              labels.empty,
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[var(--muted-foreground)] flex items-center gap-1.5">
                            <i className="h-2 w-2 rounded-full bg-slate-400" />
                            {labels.liabilities}:
                          </span>
                          <span className="text-[var(--foreground)]">
                            {formatMinor(
                              data.rawLiabilities,
                              series.currency,
                              locale,
                              labels.empty,
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          {data.isComplete ? labels.complete : labels.incomplete}
                        </span>
                        {data.missing && data.missing.length > 0 ? (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 max-w-[160px] truncate">
                            {labels.missing}: {data.missing.join(", ")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="#8DB83E"
                strokeWidth={2.5}
                fillOpacity={1}
                fill={`url(#netWorthGradient-${series.currency})`}
                name={labels.netWorth}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-5 text-center text-sm text-[var(--muted-foreground)]">
          {labels.empty}
        </div>
      )}
    </div>
  );
}
