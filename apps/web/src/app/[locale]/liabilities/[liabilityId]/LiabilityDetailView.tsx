"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

import type { SerializedHouseholdAccount } from "@/lib/accounts/serialization";
import type {
  SerializedHouseholdLiability,
  SerializedLiabilityRepayment,
} from "@/lib/liabilities/schema";
import { formatAmountPresentation } from "@/lib/transactions/presentation";
import { LIABILITY_KINDS, type LiabilityKind } from "@nodvis/finance-domain";

type Props = {
  householdId: string;
  locale: string;
  initialLiability: SerializedHouseholdLiability;
  initialRepayments: SerializedLiabilityRepayment[];
  accounts: SerializedHouseholdAccount[];
};

export function LiabilityDetailView({
  householdId,
  locale,
  initialLiability,
  initialRepayments,
  accounts,
}: Props) {
  const t = useTranslations("Liabilities");
  const router = useRouter();
  const [liability, setLiability] = useState(initialLiability);
  const [repayments, setRepayments] = useState(initialRepayments);
  const [editing, setEditing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initialLiability.name);
  const [kind, setKind] = useState<LiabilityKind>(initialLiability.kind);
  const [lender, setLender] = useState(initialLiability.lender ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(initialLiability.destinationAccountId ?? "");
  const [paidAt, setPaidAt] = useState("");
  const [amount, setAmount] = useState("");
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const [fee, setFee] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const currencyAccounts = accounts.filter(
    (account) => account.currency === liability.currency && account.archivedAt === null,
  );

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const response = await fetch(`/api/households/${householdId}/liabilities/${liability.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kind,
          lender: lender || null,
          destinationAccountId: destinationAccountId || null,
          expectedVersion: liability.version,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(t("form.errorGeneric"));
      setLiability(json.data);
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("form.errorGeneric"));
    }
  }

  async function recordRepayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecording(true);
    setError(null);
    try {
      const response = await fetch(`/api/households/${householdId}/liabilities/${liability.id}/repayments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidAt,
          amountNatural: amount,
          principalNatural: principal || null,
          interestNatural: interest || null,
          feeNatural: fee || null,
          sourceAccountId: sourceAccountId || null,
          notes: notes || null,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(t("repaymentForm.errorGeneric"));
      setRepayments((current) => [json.data.repayment, ...current]);
      setPaidAt(""); setAmount(""); setPrincipal(""); setInterest(""); setFee(""); setNotes("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("repaymentForm.errorGeneric"));
    } finally {
      setRecording(false);
    }
  }

  async function voidRepayment(repayment: SerializedLiabilityRepayment) {
    if (!window.confirm(t("voidForm.description"))) return;
    setVoidingId(repayment.id);
    setError(null);
    try {
      const response = await fetch(`/api/households/${householdId}/liabilities/${liability.id}/repayments/${repayment.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: repayment.version }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(t("voidForm.errorGeneric"));
      setRepayments((current) => current.map((item) => item.id === repayment.id ? json.data : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("voidForm.errorGeneric"));
    } finally {
      setVoidingId(null);
    }
  }

  async function changeArchive(action: "archive" | "unarchive") {
    if (action === "archive" && !window.confirm(t("archiveConfirm"))) return;
    setError(null);
    try {
      const response = await fetch(`/api/households/${householdId}/liabilities/${liability.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: liability.version }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(t("form.errorGeneric"));
      setLiability(json.data);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("form.errorGeneric"));
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/liabilities" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">← {t("detail.backToList")}</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{t("detail.overview")}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-stone-100">{liability.name}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">{liability.lender ?? t("detail.noDestinationAccount")} · {t(`kinds.${liability.kind}`)} · {liability.currency}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-stone-600">{t("actions.edit")}</button>
          {liability.archivedAt === null ? <button type="button" onClick={() => void changeArchive("archive")} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/50 dark:text-rose-300">{t("actions.archive")}</button> : <button type="button" onClick={() => void changeArchive("unarchive")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-stone-600">{t("actions.unarchive")}</button>}
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900"><p className="text-sm text-slate-500 dark:text-stone-400">{t("balance.outstanding")}</p><p className="mt-2 text-2xl font-semibold">{liability.observedOutstandingMinor === null ? t("balance.unknown") : formatAmountPresentation(liability.observedOutstandingMinor, liability.currency, locale)}</p><p className="mt-1 text-xs text-slate-500 dark:text-stone-400">{liability.observedOutstandingAt ? t("balance.observedAt", { date: new Intl.DateTimeFormat(locale).format(new Date(liability.observedOutstandingAt)) }) : t("balance.unknown")}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900"><p className="text-sm text-slate-500 dark:text-stone-400">{t("detail.destinationAccount")}</p><p className="mt-2 font-semibold">{liability.destinationAccountName ?? t("detail.noDestinationAccount")}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900"><p className="text-sm text-slate-500 dark:text-stone-400">{t("detail.repaymentsTitle")}</p><p className="mt-2 text-2xl font-semibold">{repayments.filter((item) => item.voidedAt === null).length}</p></div>
      </section>

      {editing && <form onSubmit={saveEdit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">{t("form.name")}<input required value={name} onChange={(event) => setName(event.target.value)} className="rounded-lg border px-3 py-2 font-normal dark:border-stone-600 dark:bg-stone-950" /></label><label className="grid gap-1 text-sm font-medium">{t("form.kind")}<select value={kind} onChange={(event) => setKind(event.target.value as LiabilityKind)} className="rounded-lg border px-3 py-2 font-normal dark:border-stone-600 dark:bg-stone-950">{LIABILITY_KINDS.map((value) => <option key={value} value={value}>{t(`kinds.${value}`)}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">{t("form.lender")}<input value={lender} onChange={(event) => setLender(event.target.value)} className="rounded-lg border px-3 py-2 font-normal dark:border-stone-600 dark:bg-stone-950" /></label><label className="grid gap-1 text-sm font-medium">{t("form.destinationAccount")}<select value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)} className="rounded-lg border px-3 py-2 font-normal dark:border-stone-600 dark:bg-stone-950"><option value="">{t("form.noAccount")}</option>{currencyAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><div className="flex gap-2 sm:col-span-2"><button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{t("actions.save")}</button><button type="button" onClick={() => setEditing(false)} className="rounded-lg border px-4 py-2 text-sm dark:border-stone-600">{t("actions.cancel")}</button></div></form>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-900">
        <h2 className="text-lg font-semibold">{t("repaymentForm.title")}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">{t("repaymentForm.allocationHelp")}</p>
        <form onSubmit={recordRepayment} className="mt-4 grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">{t("repaymentForm.paidAt")}<input required type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className="rounded-lg border px-3 py-2 font-normal dark:border-stone-600 dark:bg-stone-950" /></label><label className="grid gap-1 text-sm font-medium">{t("repaymentForm.amount")}<input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={t("repaymentForm.amountPlaceholder")} className="rounded-lg border px-3 py-2 font-normal dark:border-stone-600 dark:bg-stone-950" /></label><MoneyField label={t("repaymentForm.principal")} value={principal} onChange={setPrincipal} placeholder={t("repaymentForm.principalPlaceholder")} /><MoneyField label={t("repaymentForm.interest")} value={interest} onChange={setInterest} placeholder={t("repaymentForm.interestPlaceholder")} /><MoneyField label={t("repaymentForm.fee")} value={fee} onChange={setFee} placeholder={t("repaymentForm.feePlaceholder")} /><label className="grid gap-1 text-sm font-medium">{t("repaymentForm.sourceAccount")}<select value={sourceAccountId} onChange={(event) => setSourceAccountId(event.target.value)} className="rounded-lg border px-3 py-2 font-normal dark:border-stone-600 dark:bg-stone-950"><option value="">{t("repaymentForm.noSourceAccount")}</option>{currencyAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium sm:col-span-2">{t("repaymentForm.notes")}<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("repaymentForm.notesPlaceholder")} className="rounded-lg border px-3 py-2 font-normal dark:border-stone-600 dark:bg-stone-950" /></label><button disabled={recording} className="w-fit rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{recording ? t("repaymentForm.submitting") : t("repaymentForm.submit")}</button></form>
      </section>

      <section className="grid gap-3"><h2 className="text-lg font-semibold">{t("detail.repaymentsTitle")}</h2>{repayments.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-sm text-slate-500 dark:border-stone-700">{t("detail.noRepayments")}</p> : repayments.map((repayment) => <article key={repayment.id} className={`rounded-2xl border p-5 ${repayment.voidedAt ? "border-slate-200 opacity-60 dark:border-stone-700" : "border-slate-200 dark:border-stone-700"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{formatAmountPresentation(repayment.amountMinor, repayment.currency, locale)}</p><p className="text-sm text-slate-500 dark:text-stone-400">{new Intl.DateTimeFormat(locale).format(new Date(repayment.paidAt))}</p></div>{repayment.voidedAt === null && <button type="button" disabled={voidingId === repayment.id} onClick={() => void voidRepayment(repayment)} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/50 dark:text-rose-300">{t("detail.voidAction")}</button>}</div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><span>{t("detail.principal")}: {repayment.principalMinor === null ? t("allocationStates.unknown") : formatAmountPresentation(repayment.principalMinor, repayment.currency, locale)}</span><span>{t("detail.interest")}: {repayment.interestMinor === null ? t("allocationStates.unknown") : formatAmountPresentation(repayment.interestMinor, repayment.currency, locale)}</span><span>{t("detail.fee")}: {repayment.feeMinor === null ? t("allocationStates.unknown") : formatAmountPresentation(repayment.feeMinor, repayment.currency, locale)}</span></div>{repayment.voidedAt && <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">{t("detail.voidedAt", { date: new Intl.DateTimeFormat(locale).format(new Date(repayment.voidedAt)) })}{repayment.voidReason ? ` · ${repayment.voidReason}` : ""}</p>}</article>)}</section>
    </main>
  );
}

function MoneyField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="grid gap-1 text-sm font-medium">{label}<input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="rounded-lg border px-3 py-2 font-normal dark:border-stone-600 dark:bg-stone-950" /></label>;
}
