import type { CashForecast } from "@nodvis/finance-domain";
import { formatAmountPresentation } from "@/lib/transactions/presentation";

type Props = { forecast: CashForecast; locale: string; labels: { title: string; subtitle: string; horizon: string; days: string; available: string; obligations: string; projected: string; incomplete: string; included: string } };

export function ForecastSection({ forecast, locale, labels }: Props) {
  return (
    <section aria-labelledby="cash-forecast-title" className="finance-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="cash-forecast-title" className="text-lg font-semibold text-slate-900 dark:text-stone-100">{labels.title}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-stone-400">{labels.subtitle}</p>
        </div>
        <span className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:text-emerald-300">{labels.horizon}: {forecast.horizonDays} {labels.days}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {forecast.byCurrency.map((item) => (
          <article key={item.currency} className="rounded-xl border border-emerald-200/80 bg-white/80 p-4 dark:border-emerald-900/60 dark:bg-stone-900/60">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-stone-400"><span>{item.currency}</span><span>{item.isComplete ? "" : labels.incomplete}</span></div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt>{labels.available}</dt><dd className="font-semibold">{formatAmountPresentation(item.availableCashMinor.toString(), item.currency, locale)}</dd></div>
              <div className="flex justify-between gap-3"><dt>{labels.obligations}</dt><dd className="font-semibold">−{formatAmountPresentation(item.includedObligationsMinor.toString(), item.currency, locale)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-emerald-100 pt-2 font-semibold dark:border-emerald-900"><dt>{labels.projected}</dt><dd className={item.status === "deficit" ? "text-red-700 dark:text-red-400" : "text-emerald-800 dark:text-emerald-300"}>{formatAmountPresentation(item.projectedCashMinor.toString(), item.currency, locale)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-500 dark:text-stone-400">{labels.included}: {item.includedObligationCount}</p>
          </article>
        ))}
      </div>
      {forecast.byCurrency.length === 0 ? <p className="mt-4 text-sm text-slate-600 dark:text-stone-400">{labels.incomplete}</p> : null}
    </section>
  );
}
