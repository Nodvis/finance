"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { HouseholdAccessSummary } from "@nodvis/finance-db";
import { maskAccountIdentifier } from "@nodvis/finance-domain";
import type { AuthorizedHouseholdUserContext } from "@/lib/authorization/household";
import { formatAmountPresentation } from "@/lib/transactions/presentation";
import type {
  SerializedReconciledTransfer,
  SerializedTransferCandidate,
  TransferCandidatesSummary,
} from "@/lib/transfers/service";

type TransfersViewProps = {
  householdContext: AuthorizedHouseholdUserContext;
  allHouseholds: HouseholdAccessSummary[];
  initialSummary: TransferCandidatesSummary;
  initialReconciled: SerializedReconciledTransfer[];
  locale: string;
};

type ActiveTab =
  | "ready_auto"
  | "review_only"
  | "one_sided_pending"
  | "ambiguous"
  | "reconciled";

export function TransfersView({
  householdContext,
  initialSummary,
  initialReconciled,
  locale,
}: TransfersViewProps) {
  const tTransfers = useTranslations("Transfers");
  const tAccess = useTranslations("Accessibility");
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>("ready_auto");
  const [candidates, setCandidates] = useState<SerializedTransferCandidate[]>(
    initialSummary.candidates,
  );
  const [counts, setCounts] = useState(initialSummary.counts);
  const [reconciled, setReconciled] = useState<SerializedReconciledTransfer[]>(
    initialReconciled,
  );

  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const readyAutoCandidates = candidates.filter(
    (c) => c.confidence === "ready_auto",
  );
  const reviewOnlyCandidates = candidates.filter(
    (c) => c.confidence === "review_only",
  );
  const oneSidedPendingCandidates = candidates.filter(
    (c) => c.confidence === "one_sided_pending",
  );
  const ambiguousCandidates = candidates.filter(
    (c) => c.confidence === "ambiguous",
  );

  const refreshCandidates = async () => {
    try {
      const [candRes, recRes] = await Promise.all([
        fetch(`/api/households/${householdContext.householdId}/transfers/candidates`),
        fetch(`/api/households/${householdContext.householdId}/transfers/reconciled`),
      ]);
      if (candRes.ok) {
        const candJson = await candRes.json();
        setCandidates(candJson.data.candidates);
        setCounts(candJson.data.counts);
      }
      if (recRes.ok) {
        const recJson = await recRes.json();
        setReconciled(recJson.data);
      }
    } catch {
      // Background refresh failure can be silently ignored or handled
    }
  };

  const handleMatch = async (
    candidate: SerializedTransferCandidate,
    confidence: "automatic" | "manual_review",
  ) => {
    if (!candidate.outflow || !candidate.inflow) return;
    setLoadingActionId(candidate.id);
    setStatusMessage(null);

    try {
      const res = await fetch(
        `/api/households/${householdContext.householdId}/transfers/match`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outflowTransactionId: candidate.outflow.transactionId,
            expectedOutflowVersion: candidate.outflow.version,
            inflowTransactionId: candidate.inflow.transactionId,
            expectedInflowVersion: candidate.inflow.version,
            matchedIdentifier: candidate.evidence.matchedIdentifier,
            matchConfidence: confidence,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok) {
        setStatusMessage({
          type: "error",
          text: json.error || tTransfers("feedback.errorGeneric"),
        });
      } else {
        setStatusMessage({
          type: "success",
          text: tTransfers("feedback.successMatch"),
        });
        await refreshCandidates();
        router.refresh();
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: tTransfers("feedback.errorGeneric"),
      });
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleAutoMatchAll = async () => {
    setIsAutoMatching(true);
    setStatusMessage(null);

    try {
      const res = await fetch(
        `/api/households/${householdContext.householdId}/transfers/auto-match`,
        { method: "POST" },
      );

      const json = await res.json();
      if (!res.ok) {
        setStatusMessage({
          type: "error",
          text: json.error || tTransfers("feedback.errorGeneric"),
        });
      } else {
        const count = json.data?.matchedCount ?? 0;
        if (count > 0) {
          setStatusMessage({
            type: "success",
            text: tTransfers("feedback.successAutoMatch", { count }),
          });
        } else {
          setStatusMessage({
            type: "success",
            text: tTransfers("feedback.noAutoMatched"),
          });
        }
        await refreshCandidates();
        router.refresh();
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: tTransfers("feedback.errorGeneric"),
      });
    } finally {
      setIsAutoMatching(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Overview */}
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400/80">
          {tTransfers("eyebrow")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-stone-100">
          {tTransfers("title")}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-500 sm:text-base dark:text-stone-400">
          {tTransfers("description")}
        </p>
      </header>

      {/* Status Feedback Notification */}
      {statusMessage && (
        <div
          role="alert"
          className={`rounded-lg border p-3 text-sm ${
            statusMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/80 dark:bg-emerald-950/60 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/80 dark:bg-rose-950/60 dark:text-rose-200"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label={tAccess("transfersTabs")}
        className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-stone-800"
      >
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "ready_auto"}
          onClick={() => setActiveTab("ready_auto")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "ready_auto"
              ? "bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 dark:text-stone-950"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          }`}
        >
          {tTransfers("tabs.readyAuto", { count: counts.readyAuto })}
        </button>

        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "review_only"}
          onClick={() => setActiveTab("review_only")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "review_only"
              ? "bg-amber-600 text-white shadow-xs dark:bg-amber-500 dark:text-stone-950"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          }`}
        >
          {tTransfers("tabs.reviewOnly", { count: counts.reviewOnly })}
        </button>

        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "one_sided_pending"}
          onClick={() => setActiveTab("one_sided_pending")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "one_sided_pending"
              ? "bg-sky-600 text-white shadow-xs dark:bg-sky-500 dark:text-stone-950"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          }`}
        >
          {tTransfers("tabs.oneSidedPending", { count: counts.oneSidedPending })}
        </button>

        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "ambiguous"}
          onClick={() => setActiveTab("ambiguous")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "ambiguous"
              ? "bg-purple-600 text-white shadow-xs dark:bg-purple-500 dark:text-stone-950"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          }`}
        >
          {tTransfers("tabs.ambiguous", { count: counts.ambiguous })}
        </button>

        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "reconciled"}
          onClick={() => setActiveTab("reconciled")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "reconciled"
              ? "bg-slate-800 text-white shadow-xs dark:bg-stone-200 dark:text-stone-900"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          }`}
        >
          {tTransfers("tabs.reconciled", { count: reconciled.length })}
        </button>
      </div>

      {/* Tab Content */}
      <section
        role="tabpanel"
        aria-label={tAccess("transfersList")}
        className="flex flex-col gap-4"
      >
        {/* Ready Auto Tab */}
        {activeTab === "ready_auto" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <p className="max-w-2xl text-xs leading-relaxed text-emerald-900 dark:text-emerald-200">
                {tTransfers("hints.readyAuto")}
              </p>
              {counts.readyAuto > 0 && (
                <button
                  type="button"
                  disabled={isAutoMatching}
                  onClick={handleAutoMatchAll}
                  className="inline-flex items-center rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
                >
                  {isAutoMatching
                    ? tTransfers("actions.autoMatching")
                    : tTransfers("actions.autoMatchAll", { count: counts.readyAuto })}
                </button>
              )}
            </div>

            {readyAutoCandidates.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-stone-800/80 dark:bg-stone-900/40">
                <h3 className="text-base font-semibold text-slate-800 dark:text-stone-200">
                  {tTransfers("empty.readyAutoTitle")}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
                  {tTransfers("empty.readyAutoDescription")}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {readyAutoCandidates.map((candidate) => (
                  <article
                    key={candidate.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors hover:border-slate-300 dark:border-stone-800 dark:bg-stone-900/70 dark:hover:border-stone-700"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Outflow Source */}
                      {candidate.outflow && (
                        <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 dark:border-rose-950/40 dark:bg-rose-950/10">
                          <div className="flex items-center justify-between text-xs font-semibold text-rose-700 dark:text-rose-400">
                            <span>{tTransfers("card.outflow")}</span>
                            <span className="font-mono">
                              {formatAmountPresentation(
                                candidate.outflow.amountMinor,
                                candidate.outflow.currency,
                                locale,
                              )}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-stone-300">
                            <div>
                              <strong className="text-slate-900 dark:text-stone-100">
                                {candidate.fromAccountName || tTransfers("card.account")}
                              </strong>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-stone-400">
                              {formatDate(candidate.outflow.occurredOn)}
                            </div>
                            {candidate.outflow.counterpartyText && (
                              <p className="text-[11px] italic text-slate-600 dark:text-stone-400">
                                {candidate.outflow.counterpartyText}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Inflow Destination */}
                      {candidate.inflow && (
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-950/40 dark:bg-emerald-950/10">
                          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <span>{tTransfers("card.inflow")}</span>
                            <span className="font-mono">
                              +{formatAmountPresentation(
                                candidate.inflow.amountMinor,
                                candidate.inflow.currency,
                                locale,
                              )}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-stone-300">
                            <div>
                              <strong className="text-slate-900 dark:text-stone-100">
                                {candidate.toAccountName || tTransfers("card.account")}
                              </strong>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-stone-400">
                              {formatDate(candidate.inflow.occurredOn)}
                            </div>
                            {candidate.inflow.counterpartyText && (
                              <p className="text-[11px] italic text-slate-600 dark:text-stone-400">
                                {candidate.inflow.counterpartyText}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer with matched identifier evidence and action */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-stone-800/60">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-stone-400">
                        {candidate.evidence.matchedIdentifier && (
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
                            {tTransfers("card.matchedIdentifier")}:{" "}
                            {maskAccountIdentifier(candidate.evidence.matchedIdentifier)}
                          </span>
                        )}
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {tTransfers("badges.readyAuto")}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={loadingActionId === candidate.id}
                        onClick={() => handleMatch(candidate, "automatic")}
                        className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-stone-950 dark:hover:bg-emerald-400"
                      >
                        {loadingActionId === candidate.id
                          ? tTransfers("actions.matching")
                          : tTransfers("actions.match")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Review Only Tab */}
        {activeTab === "review_only" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
              <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                {tTransfers("hints.reviewOnly")}
              </p>
            </div>

            {reviewOnlyCandidates.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-stone-800/80 dark:bg-stone-900/40">
                <h3 className="text-base font-semibold text-slate-800 dark:text-stone-200">
                  {tTransfers("empty.reviewOnlyTitle")}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
                  {tTransfers("empty.reviewOnlyDescription")}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {reviewOnlyCandidates.map((candidate) => (
                  <article
                    key={candidate.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors hover:border-slate-300 dark:border-stone-800 dark:bg-stone-900/70 dark:hover:border-stone-700"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Outflow Source */}
                      {candidate.outflow && (
                        <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 dark:border-rose-950/40 dark:bg-rose-950/10">
                          <div className="flex items-center justify-between text-xs font-semibold text-rose-700 dark:text-rose-400">
                            <span>{tTransfers("card.outflow")}</span>
                            <span className="font-mono">
                              {formatAmountPresentation(
                                candidate.outflow.amountMinor,
                                candidate.outflow.currency,
                                locale,
                              )}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-stone-300">
                            <div>
                              <strong className="text-slate-900 dark:text-stone-100">
                                {candidate.fromAccountName || tTransfers("card.account")}
                              </strong>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-stone-400">
                              {formatDate(candidate.outflow.occurredOn)}
                            </div>
                            {candidate.outflow.counterpartyText && (
                              <p className="text-[11px] italic text-slate-600 dark:text-stone-400">
                                {candidate.outflow.counterpartyText}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Inflow Destination */}
                      {candidate.inflow && (
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-950/40 dark:bg-emerald-950/10">
                          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <span>{tTransfers("card.inflow")}</span>
                            <span className="font-mono">
                              +{formatAmountPresentation(
                                candidate.inflow.amountMinor,
                                candidate.inflow.currency,
                                locale,
                              )}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-stone-300">
                            <div>
                              <strong className="text-slate-900 dark:text-stone-100">
                                {candidate.toAccountName || tTransfers("card.account")}
                              </strong>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-stone-400">
                              {formatDate(candidate.inflow.occurredOn)}
                            </div>
                            {candidate.inflow.counterpartyText && (
                              <p className="text-[11px] italic text-slate-600 dark:text-stone-400">
                                {candidate.inflow.counterpartyText}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-stone-800/60">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          {tTransfers("badges.reviewOnly")}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-stone-400">
                          Δ {candidate.evidence.dateDifferenceDays}d
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={loadingActionId === candidate.id}
                        onClick={() => handleMatch(candidate, "manual_review")}
                        className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-amber-500 disabled:opacity-50 dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400"
                      >
                        {loadingActionId === candidate.id
                          ? tTransfers("actions.matching")
                          : tTransfers("actions.confirmMatch")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* One Sided Pending Tab */}
        {activeTab === "one_sided_pending" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900/60 dark:bg-sky-950/20">
              <p className="text-xs leading-relaxed text-sky-900 dark:text-sky-200">
                {tTransfers("hints.oneSidedPending")}
              </p>
            </div>

            {oneSidedPendingCandidates.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-stone-800/80 dark:bg-stone-900/40">
                <h3 className="text-base font-semibold text-slate-800 dark:text-stone-200">
                  {tTransfers("empty.oneSidedPendingTitle")}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
                  {tTransfers("empty.oneSidedPendingDescription")}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {oneSidedPendingCandidates.map((candidate) => (
                  <article
                    key={candidate.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900/70"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      {candidate.outflow && (
                        <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 dark:border-rose-950/40 dark:bg-rose-950/10">
                          <div className="flex items-center justify-between text-xs font-semibold text-rose-700 dark:text-rose-400">
                            <span>{tTransfers("card.outflow")}</span>
                            <span className="font-mono">
                              {formatAmountPresentation(
                                candidate.outflow.amountMinor,
                                candidate.outflow.currency,
                                locale,
                              )}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-stone-300">
                            <div>
                              <strong className="text-slate-900 dark:text-stone-100">
                                {candidate.fromAccountName || tTransfers("card.account")}
                              </strong>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-stone-400">
                              {formatDate(candidate.outflow.occurredOn)}
                            </div>
                            {candidate.outflow.counterpartyText && (
                              <p className="text-[11px] italic text-slate-600 dark:text-stone-400">
                                {candidate.outflow.counterpartyText}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col justify-center rounded-xl border border-dashed border-sky-200 bg-sky-50/20 p-4 text-center dark:border-sky-900/40 dark:bg-sky-950/10">
                        <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                          {tTransfers("badges.oneSidedPending")}
                        </span>
                        <p className="mt-1 text-xs text-slate-600 dark:text-stone-300">
                          {tTransfers("card.inflow")}:{" "}
                          <strong>{candidate.toAccountName}</strong>
                        </p>
                        {candidate.evidence.matchedIdentifier && (
                          <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-stone-400">
                            {maskAccountIdentifier(candidate.evidence.matchedIdentifier)}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ambiguous Tab */}
        {activeTab === "ambiguous" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900/60 dark:bg-purple-950/20">
              <p className="text-xs leading-relaxed text-purple-900 dark:text-purple-200">
                {tTransfers("hints.ambiguous")}
              </p>
            </div>

            {ambiguousCandidates.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-stone-800/80 dark:bg-stone-900/40">
                <h3 className="text-base font-semibold text-slate-800 dark:text-stone-200">
                  {tTransfers("empty.ambiguousTitle")}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
                  {tTransfers("empty.ambiguousDescription")}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {ambiguousCandidates.map((candidate) => (
                  <article
                    key={candidate.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900/70"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      {candidate.outflow && (
                        <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 dark:border-rose-950/40 dark:bg-rose-950/10">
                          <div className="flex items-center justify-between text-xs font-semibold text-rose-700 dark:text-rose-400">
                            <span>{tTransfers("card.outflow")}</span>
                            <span className="font-mono">
                              {formatAmountPresentation(
                                candidate.outflow.amountMinor,
                                candidate.outflow.currency,
                                locale,
                              )}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-stone-300">
                            <div>
                              <strong className="text-slate-900 dark:text-stone-100">
                                {candidate.fromAccountName}
                              </strong>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-stone-400">
                              {formatDate(candidate.outflow.occurredOn)}
                            </div>
                            {candidate.outflow.counterpartyText && (
                              <p className="text-[11px] italic text-slate-600 dark:text-stone-400">
                                {candidate.outflow.counterpartyText}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {candidate.inflow && (
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-950/40 dark:bg-emerald-950/10">
                          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <span>{tTransfers("card.inflow")}</span>
                            <span className="font-mono">
                              +{formatAmountPresentation(
                                candidate.inflow.amountMinor,
                                candidate.inflow.currency,
                                locale,
                              )}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-stone-300">
                            <div>
                              <strong className="text-slate-900 dark:text-stone-100">
                                {candidate.toAccountName}
                              </strong>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-stone-400">
                              {formatDate(candidate.inflow.occurredOn)}
                            </div>
                            {candidate.inflow.counterpartyText && (
                              <p className="text-[11px] italic text-slate-600 dark:text-stone-400">
                                {candidate.inflow.counterpartyText}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-stone-800/60">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                          {tTransfers("badges.ambiguous")}
                        </span>
                        {candidate.evidence.uncertaintyReasons.map((reason, idx) => (
                          <span
                            key={idx}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>

                      {candidate.outflow && candidate.inflow && (
                        <button
                          type="button"
                          disabled={loadingActionId === candidate.id}
                          onClick={() => handleMatch(candidate, "manual_review")}
                          className="rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-purple-500 disabled:opacity-50 dark:bg-purple-500 dark:text-stone-950 dark:hover:bg-purple-400"
                        >
                          {loadingActionId === candidate.id
                            ? tTransfers("actions.matching")
                            : tTransfers("actions.confirmMatch")}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reconciled History Tab */}
        {activeTab === "reconciled" && (
          <div className="flex flex-col gap-4">
            {reconciled.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-stone-800/80 dark:bg-stone-900/40">
                <h3 className="text-base font-semibold text-slate-800 dark:text-stone-200">
                  {tTransfers("empty.reconciledTitle")}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
                  {tTransfers("empty.reconciledDescription")}
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900/70">
                <div className="divide-y divide-slate-100 dark:divide-stone-800">
                  {reconciled.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-stone-100">
                            {rec.matchConfidence === "automatic"
                              ? tTransfers("badges.readyAuto")
                              : tTransfers("badges.reviewOnly")}
                          </span>
                          <span className="text-slate-400 dark:text-stone-500">·</span>
                          <span className="text-slate-500 dark:text-stone-400">
                            {tTransfers("card.reconciledAt")}: {formatDate(rec.createdAt)}
                          </span>
                        </div>
                        {rec.matchedIdentifier && (
                          <div className="font-mono text-[11px] text-slate-600 dark:text-stone-400">
                            {tTransfers("card.matchedIdentifier")}:{" "}
                            {maskAccountIdentifier(rec.matchedIdentifier)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400 dark:text-stone-500">
                        <span>TX: {rec.transferTransactionId.slice(0, 8)}…</span>
                        <span>↔</span>
                        <span>TX: {rec.matchedTransactionId.slice(0, 8)}…</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
