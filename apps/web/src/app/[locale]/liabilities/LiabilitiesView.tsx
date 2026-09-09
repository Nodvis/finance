"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import type { SerializedHouseholdAccount } from "@/lib/accounts/serialization";
import type { SerializedHouseholdLiability } from "@/lib/liabilities/schema";
import { formatAmountPresentation } from "@/lib/transactions/presentation";
import { LIABILITY_KINDS, type LiabilityKind } from "@nodvis/finance-domain";

type SerializedCreditFacility = {
  id: string;
  kind: "overdraft" | "revolving" | "credit_card" | "bnpl";
  name: string;
  currency: string;
  approvedLimitMinor: string | null;
  observedUsedMinor: string | null;
  observedAvailableMinor: string | null;
  observedAt: string | null;
  archivedAt: string | null;
  version: number;
};

type Props = {
  householdContext: AuthorizedHouseholdUserContext;
  initialLiabilities: SerializedHouseholdLiability[];
  accounts: SerializedHouseholdAccount[];
  initialFacilities: SerializedCreditFacility[];
  locale: string;
};

export function LiabilitiesView({ householdContext, initialLiabilities, accounts, initialFacilities, locale }: Props) {
  const t = useTranslations("Liabilities");
  const router = useRouter();
  const [items, setItems] = useState(initialLiabilities);
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<LiabilityKind>("loan");
  const [currency, setCurrency] = useState(householdContext.defaultCurrency);
  const [lender, setLender] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [observedOutstandingNatural, setObservedOutstandingNatural] = useState("");
  const [observedOutstandingAt, setObservedOutstandingAt] = useState("");

  const active = items.filter((item) => item.archivedAt === null);
  const archived = items.filter((item) => item.archivedAt !== null);
  const currencyAccounts = accounts.filter((account) => account.currency === currency && account.archivedAt === null);

  async function createLiability(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(null);
    try {
      const response = await fetch(`/api/households/${householdContext.householdId}/liabilities`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, kind, currency, lender: lender || null,
          destinationAccountId: destinationAccountId || null,
          observedOutstandingNatural: observedOutstandingNatural || null,
          observedOutstandingAt: observedOutstandingNatural ? (observedOutstandingAt || null) : null,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(t("form.errorGeneric"));
      setItems((current) => [...current, json.data]);
      setName(""); setLender(""); setDestinationAccountId("");
      setObservedOutstandingNatural(""); setObservedOutstandingAt(""); setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("form.errorGeneric"));
    } finally { setPending(false); }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{t("eyebrow")}</p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-stone-100 sm:text-3xl">{t("title")}</h1><p className="mt-1 text-sm text-slate-500 dark:text-stone-400">{t("description")}</p></div>
          <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">{t("actions.addLiability")}</button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}

      {open && <form onSubmit={createLiability} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-stone-700 dark:bg-stone-900 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-lg font-semibold text-slate-900 dark:text-stone-100">{t("form.titleAdd")}</h2>
        <label className="grid gap-1 text-sm font-medium">{t("form.name")}<input required value={name} onChange={(event) => setName(event.target.value)} placeholder={t("form.namePlaceholder")} className="rounded-lg border px-3 py-2 font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">{t("form.kind")}<select value={kind} onChange={(event) => setKind(event.target.value as LiabilityKind)} className="rounded-lg border px-3 py-2 font-normal">{LIABILITY_KINDS.map((value) => <option key={value} value={value}>{t(`kinds.${value}`)}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">{t("form.currency")}<input required maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className="rounded-lg border px-3 py-2 font-normal uppercase" /></label>
        <label className="grid gap-1 text-sm font-medium">{t("form.lender")}<input value={lender} onChange={(event) => setLender(event.target.value)} placeholder={t("form.lenderPlaceholder")} className="rounded-lg border px-3 py-2 font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">{t("form.destinationAccount")}<select value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)} className="rounded-lg border px-3 py-2 font-normal"><option value="">{t("form.noAccount")}</option>{currencyAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">{t("form.observedOutstanding")}<input inputMode="decimal" value={observedOutstandingNatural} onChange={(event) => setObservedOutstandingNatural(event.target.value)} placeholder={t("form.observedOutstandingPlaceholder")} className="rounded-lg border px-3 py-2 font-normal" /></label>
        {observedOutstandingNatural && <label className="grid gap-1 text-sm font-medium">{t("form.observedOutstandingAt")}<input required type="date" value={observedOutstandingAt} onChange={(event) => setObservedOutstandingAt(event.target.value)} className="rounded-lg border px-3 py-2 font-normal" /></label>}
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-sm">{t("actions.cancel")}</button><button disabled={pending} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? t("form.submittingAdd") : t("form.submitAdd")}</button></div>
      </form>}

      {initialFacilities.filter((facility) => facility.kind === "revolving" || facility.kind === "bnpl").length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-stone-300">{t("independentFacilities")}</h2>
          {initialFacilities.filter((facility) => facility.kind === "revolving" || facility.kind === "bnpl").map((facility) => (
            <article key={facility.id} className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 dark:border-sky-900/60 dark:bg-sky-950/20">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900 dark:text-stone-100">{facility.name}</h3><p className="text-sm text-slate-500 dark:text-stone-400">{facility.kind === "revolving" ? t("facilityRevolving") : t("facilityBnpl")}</p></div><span className="rounded-full bg-white/70 px-2 py-1 text-xs dark:bg-stone-900/70">{facility.currency}</span></div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><p><span className="block text-xs text-slate-500 dark:text-stone-400">{t("facilityLimit")}</span><strong>{facility.approvedLimitMinor === null ? t("balance.unknown") : formatAmountPresentation(facility.approvedLimitMinor, facility.currency, locale)}</strong></p><p><span className="block text-xs text-slate-500 dark:text-stone-400">{facility.observedUsedMinor === null ? t("balance.unknown") : t("facilityUsed")}</span><strong>{facility.observedUsedMinor === null ? "—" : formatAmountPresentation(facility.observedUsedMinor, facility.currency, locale)}</strong></p><p><span className="block text-xs text-slate-500 dark:text-stone-400">{facility.observedAvailableMinor === null ? t("balance.unknown") : t("facilityAvailable")}</span><strong>{facility.observedAvailableMinor === null ? "—" : formatAmountPresentation(facility.observedAvailableMinor, facility.currency, locale)}</strong></p></div>
            </article>
          ))}
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-stone-300">{t("activeLiabilities")}</h2>
        {active.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-sm text-slate-500 dark:border-stone-700 dark:text-stone-400">{t("emptyActiveDescription")}</div> : active.map((item) => <LiabilityCard key={item.id} item={item} locale={locale} t={t} />)}
      </section>
      {archived.length > 0 && <section className="grid gap-3"><button type="button" onClick={() => setShowArchived((value) => !value)} className="text-left text-sm font-semibold text-slate-700 dark:text-stone-300">{showArchived ? t("hideArchived") : t("showArchived", { count: archived.length })}</button>{showArchived && archived.map((item) => <LiabilityCard key={item.id} item={item} locale={locale} t={t} />)}</section>}
    </main>
  );
}

function LiabilityCard({ item, locale, t }: { item: SerializedHouseholdLiability; locale: string; t: ReturnType<typeof useTranslations<"Liabilities">> }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-stone-700 dark:bg-stone-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900 dark:text-stone-100">{item.name}</h3><p className="text-sm text-slate-500 dark:text-stone-400">{item.lender ?? t("detail.noDestinationAccount")} · {t(`kinds.${item.kind}`)}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-stone-800">{item.currency}</span></div><p className="mt-4 text-xl font-semibold text-slate-900 dark:text-stone-100">{item.observedOutstandingMinor === null ? t("balance.unknown") : formatAmountPresentation(item.observedOutstandingMinor, item.currency, locale)}</p><p className="mt-1 text-xs text-slate-500 dark:text-stone-400">{item.observedOutstandingAt ? t("balance.observedAt", { date: new Intl.DateTimeFormat(locale).format(new Date(item.observedOutstandingAt)) }) : t("balance.unknown")}</p><Link href={`/liabilities/${item.id}`} className="mt-4 inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800">{t("actions.details")}</Link></article>;
}
